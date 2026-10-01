import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Tỷ giá USD/VND live từ TECHCOMBANK (ngân hàng công ty nhận USD).
 * Slug `vcb-exchange-rate` là tên lịch sử — giữ nguyên để khỏi đổi URL phía client.
 *
 * Tên trường API TCB:  CK = chuyển khoản, TM = tiền mặt
 *   bidRateCK = mua CK | askRate = bán CK | bidRateTM = mua TM | askRateTM = bán TM
 * Trước 2026-10 code map nhầm buy/sell sang giá TIỀN MẶT.
 * Tỷ giá ghi HĐ dịch vụ = (mua CK + bán CK)/2 của NH thường giao dịch (TT 99/2025).
 */
const TCB_URL =
  "https://techcombank.com/content/techcombank/web/vn/vi/cong-cu-tien-ich/ty-gia/_jcr_content.exchange-rates.integration.json";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const res = await fetch(TCB_URL, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!res.ok) {
      throw new Error(`TCB API returned ${res.status}`);
    }

    const json = await res.json();
    const rates: any[] = json?.exchangeRate?.data || [];

    // Chỉ dòng USD (50,100) có giá chuyển khoản (bidRateCK + askRate)
    const usdEntry = rates.find(
      (r) => r.sourceCurrency === "USD" && r.bidRateCK && r.askRate
    );

    if (!usdEntry) {
      throw new Error("USD transfer rate not found in TCB response");
    }

    const parse = (s: string) => parseFloat(String(s).replace(/,/g, ""));

    const buy = parse(usdEntry.bidRateCK);   // Mua chuyển khoản
    const sell = parse(usdEntry.askRate);    // Bán chuyển khoản
    if (!(buy > 0) || !(sell > 0) || buy > sell) {
      throw new Error(`Invalid TCB transfer rate: buy=${buy} sell=${sell}`);
    }

    const result = {
      currency: "USD",
      buy,
      transfer: buy,
      sell,
      buy_cash: usdEntry.bidRateTM ? parse(usdEntry.bidRateTM) : null,   // Mua tiền mặt
      sell_cash: usdEntry.askRateTM ? parse(usdEntry.askRateTM) : null,  // Bán tiền mặt
      updated_at: usdEntry.inputDate || new Date().toISOString(),
      source: "Techcombank",
    };

    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300", // cache 5 phút
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
