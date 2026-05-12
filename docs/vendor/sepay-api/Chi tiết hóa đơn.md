# Chi tiết hóa đơn

## API lấy chi tiết hóa đơn trả về thông tin chi tiết hóa đơn tương ứng với mã tham chiếu

---

**API Overview:**

API tạo và quản lý hóa đơn điện tử theo quy định của Tổng cục Thuế Việt Nam.

**Base URLs:**
- Production: `https://einvoice-api.sepay.vn`
- Sandbox: `https://einvoice-api-sandbox.sepay.vn`


---

#### API Endpoint

<Endpoint>
  <Method>GET</Method>

  <Path>https://einvoice-api.sepay.vn/v1/invoices/{reference_code}</Path>

  <Description>
    Chi tiết hóa đơn
  </Description>

  <Authentication>
    bearerAuth
  </Authentication>
</Endpoint>

#### API Request

<Params>
  <PathParams>
    <Param name="reference_code" type="string" required="true">
      Mã tham chiếu hóa đơn
    </Param>
  </PathParams>

</Params>

<Callout type="info" title="Lấy reference_code từ đâu?">
`reference_code`
 là mã tham chiếu duy nhất của hóa đơn, bạn có thể lấy từ:
API Xuất hóa đơn
 - Trả về trong response khi kiểm tra trạng thái xuất hóa đơn (
`/v1/invoices/create/check/{tracking_code}`
)
API Phát hành hóa đơn
 - Trả về trong response khi kiểm tra trạng thái phát hành (
`/v1/invoices/issue/check/{tracking_code}`
)
API Danh sách hóa đơn
 - Mỗi hóa đơn trong danh sách đều có 
`reference_code`
 (
`/v1/invoices`
)
</Callout>

#### API Response

<Responses>
  <Response status="200">
    <Description>
      Chi tiết hóa đơn
    </Description>

    <Example>
      {
        "success": true,
        "data": {
          "reference_code": "084e179d-d95a-11f0-aef4-52c7e9b4f41b",
          "invoice_number": "589",
          "issued_date": "2025-12-15",
          "pdf_url": "https://beta-portalv2.mifi.vn/DownloadPDFCA.aspx?...",
          "xml_url": null,
          "status": "issued",
          "buyer": {
            "name": "Công ty ABC",
            "tax_code": "0101234567",
            "address": "123 Đường A, Quận B, Hà Nội",
            "email": "buyer@example.com",
            "phone": "0900000000"
          },
          "total_before_tax": 200000,
          "tax_amount": 20000,
          "total_amount": 220000,
          "notes": "Ghi chú hóa đơn",
          "items": [
            {
              "line_number": 1,
              "line_type": 1,
              "item_code": "SP001",
              "item_name": "Sản phẩm A",
              "unit": "cái",
              "quantity": "2.00",
              "unit_price": "100000.00",
              "total_amount": "200000.00",
              "tax_rate": "10.00",
              "tax_amount": "20000.00"
            }
          ]
        }
      }
    </Example>
  </Response>

</Responses>

<ResponseDescriptionFields>
  <ResponseSchema status="200">
    <Fields>
      <Field name="success" type="boolean" required="false">
      </Field>
      <Field name="data" type="object" required="false">
        <Fields>
          <Field name="reference_code" type="string" required="false">
            Mã tham chiếu hóa đơn
          </Field>
          <Field name="invoice_number" type="string" required="false">
            Số hóa đơn
          </Field>
          <Field name="invoice_series" type="string" required="false">
            Ký hiệu hóa đơn (ví dụ "AA/24E"). Tiền tố theo mẫu hóa đơn.
          </Field>
          <Field name="document_type" type="integer" required="false">
            Loại chứng từ hóa đơn. Giá trị enum:
- `1` - Hóa đơn nháp
- `2` - Hóa đơn mới
- `3` - Hóa đơn đã hủy
- `4` - Hóa đơn thay thế
- `5` - Hóa đơn bị thay thế
- `6` - Hóa đơn điều chỉnh tăng
- `7` - Hóa đơn điều chỉnh giảm
- `8` - Hóa đơn điều chỉnh thông tin
- `9` - Hóa đơn điều chỉnh tăng/giảm
- `10` - Hóa đơn bị điều chỉnh

          </Field>
          <Field name="issued_date" type="string" required="false">
            Ngày phát hành hóa đơn
          </Field>
          <Field name="pdf_url" type="string" required="false">
            Link tải PDF
          </Field>
          <Field name="xml_url" type="string" required="false">
            Link tải XML (nếu có)
          </Field>
          <Field name="status" type="enum: draft, issued, cancelled" required="false">
            Trạng thái hóa đơn
          </Field>
          <Field name="tax_authority_code" type="string" required="false">
            Mã cơ quan thuế. Có giá trị khi hóa đơn đã được đăng ký với cơ quan thuế Việt Nam.
          </Field>
          <Field name="provider_status" type="string" required="false">
            Trạng thái xử lý từ nhà cung cấp hóa đơn điện tử. Khác với trạng thái nội bộ SePay (`status`). Giá trị enum:
- `1` - Nháp
- `2` - Lỗi ký
- `3` - Chưa gửi CQT
- `4` - Đã cấp mã/tiếp nhận
- `5` - CQT chưa phản hồi
- `6` - Không đủ ĐK cấp mã
- `7` - [04/SS] Chưa tạo tờ khai
- `8` - [04/SS] CQT chưa tiếp nhận
- `9` - [04/SS] CQT đã phê duyệt

          </Field>
          <Field name="payment_method" type="string" required="false">
            Phương thức thanh toán của hóa đơn (ví dụ "TM/CK").
          </Field>
          <Field name="buyer" type="object" required="false">
            <Fields>
              <Field name="type" type="enum: personal, company" required="false">
                Loại người mua (personal, company)
              </Field>
              <Field name="name" type="string" required="true">
                Tên người/đơn vị mua
              </Field>
              <Field name="legal_name" type="string" required="false">
                Tên pháp lý (dùng cho công ty)
              </Field>
              <Field name="tax_code" type="string" required="false">
                Mã số thuế
              </Field>
              <Field name="address" type="string" required="false">
                Địa chỉ
              </Field>
              <Field name="email" type="string (email)" required="false">
                Email nhận hóa đơn
              </Field>
              <Field name="phone" type="string" required="false">
                Số điện thoại
              </Field>
              <Field name="buyer_code" type="string" required="false">
                Mã khách hàng (mã người mua hàng)
              </Field>
              <Field name="national_id" type="string" required="false">
                Căn cước công dân / Số CCCD / Số định danh cá nhân
              </Field>
            </Fields>
          </Field>
          <Field name="total_before_tax" type="number" required="false">
            Tổng tiền trước thuế
          </Field>
          <Field name="tax_amount" type="number" required="false">
            Tiền thuế
          </Field>
          <Field name="total_amount" type="number" required="false">
            Tổng thanh toán
          </Field>
          <Field name="notes" type="string" required="false">
            Ghi chú hóa đơn
          </Field>
          <Field name="items" type="array" required="false">
            <Description>Danh sách dòng hàng</Description>
            <ArrayItems>
              <Fields>
                <Field name="line_number" type="integer" required="false">
                  Số thứ tự dòng
                </Field>
                <Field name="line_type" type="integer" required="false">
                  Loại hàng hóa
                </Field>
                <Field name="item_code" type="string" required="false">
                  Mã hàng
                </Field>
                <Field name="item_name" type="string" required="false">
                  Tên hàng
                </Field>
                <Field name="unit" type="string" required="false">
                  Đơn vị tính
                </Field>
                <Field name="quantity" type="string" required="false">
                  Số lượng
                </Field>
                <Field name="unit_price" type="string" required="false">
                  Đơn giá
                </Field>
                <Field name="total_amount" type="string" required="false">
                  Thành tiền dòng
                </Field>
                <Field name="tax_rate" type="string" required="false">
                  Thuế suất (%)
                </Field>
                <Field name="tax_amount" type="string" required="false">
                  Tiền thuế dòng
                </Field>
              </Fields>
            </ArrayItems>
          </Field>
        </Fields>
      </Field>
    </Fields>
  </ResponseSchema>

</ResponseDescriptionFields>

#### Xử lý lỗi

<ErrorCodes
  hiddenHead={true}
  rows={[
  { code: 401, name: "Unauthorized", description: "Thiếu hoặc sai Bearer token. Kiểm tra lại header Authorization." },
  { code: 404, name: "Not Found", description: "Không tìm thấy hóa đơn theo reference_code. Kiểm tra lại mã tham chiếu." }
]}
/>

#### Code mẫu

<CodeSamples>
  <CodeSamplesList>
    <CodeSamplesTrigger value="shell_curl">
      cURL
    </CodeSamplesTrigger>

    <CodeSamplesTrigger value="php_curl">
      PHP
    </CodeSamplesTrigger>

    <CodeSamplesTrigger value="python_python3">
      Python
    </CodeSamplesTrigger>

    <CodeSamplesTrigger value="node_native">
      NodeJS
    </CodeSamplesTrigger>

    <CodeSamplesTrigger value="java_okhttp">
      Java
    </CodeSamplesTrigger>

    <CodeSamplesTrigger value="ruby_native">
      Ruby
    </CodeSamplesTrigger>

    <CodeSamplesTrigger value="go_native">
      Go
    </CodeSamplesTrigger>

    <CodeSamplesTrigger value="csharp_httpclient">
      .NET
    </CodeSamplesTrigger>

    <CodeSamplesTrigger value="swift_nsurlsession">
      Swift
    </CodeSamplesTrigger>

    <CodeSamplesTrigger value="kotlin_okhttp">
      Kotlin
    </CodeSamplesTrigger>

  </CodeSamplesList>

  <CodeSample value="shell_curl" lang="bash">
    ```bash
    curl --request GET \
      --url https://einvoice-api.sepay.vn/v1/invoices/084e179d-d95a-11f0-aef4-52c7e9b4f41b \
      --header 'Authorization: Bearer REPLACE_BEARER_TOKEN'
    ```
  </CodeSample>

  <CodeSample value="php_curl" lang="php">
    ```php
    <?php
    
    $curl = curl_init();
    
    curl_setopt_array($curl, [
      CURLOPT_URL => "https://einvoice-api.sepay.vn/v1/invoices/084e179d-d95a-11f0-aef4-52c7e9b4f41b",
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_ENCODING => "",
      CURLOPT_MAXREDIRS => 10,
      CURLOPT_TIMEOUT => 30,
      CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
      CURLOPT_CUSTOMREQUEST => "GET",
      CURLOPT_HTTPHEADER => [
        "Authorization: Bearer REPLACE_BEARER_TOKEN"
      ],
    ]);
    
    $response = curl_exec($curl);
    $err = curl_error($curl);
    
    curl_close($curl);
    
    if ($err) {
      echo "cURL Error #:" . $err;
    } else {
      echo $response;
    }
    ```
  </CodeSample>

  <CodeSample value="python_python3" lang="python">
    ```python
    import http.client
    
    conn = http.client.HTTPSConnection("einvoice-api.sepay.vn")
    
    headers = { 'Authorization': "Bearer REPLACE_BEARER_TOKEN" }
    
    conn.request("GET", "/v1/invoices/084e179d-d95a-11f0-aef4-52c7e9b4f41b", headers=headers)
    
    res = conn.getresponse()
    data = res.read()
    
    print(data.decode("utf-8"))
    ```
  </CodeSample>

  <CodeSample value="node_native" lang="javascript">
    ```javascript
    const http = require("https");
    
    const options = {
      "method": "GET",
      "hostname": "einvoice-api.sepay.vn",
      "port": null,
      "path": "/v1/invoices/084e179d-d95a-11f0-aef4-52c7e9b4f41b",
      "headers": {
        "Authorization": "Bearer REPLACE_BEARER_TOKEN"
      }
    };
    
    const req = http.request(options, function (res) {
      const chunks = [];
    
      res.on("data", function (chunk) {
        chunks.push(chunk);
      });
    
      res.on("end", function () {
        const body = Buffer.concat(chunks);
        console.log(body.toString());
      });
    });
    
    req.end();
    ```
  </CodeSample>

  <CodeSample value="java_okhttp" lang="java">
    ```java
    OkHttpClient client = new OkHttpClient();
    
    Request request = new Request.Builder()
      .url("https://einvoice-api.sepay.vn/v1/invoices/084e179d-d95a-11f0-aef4-52c7e9b4f41b")
      .get()
      .addHeader("Authorization", "Bearer REPLACE_BEARER_TOKEN")
      .build();
    
    Response response = client.newCall(request).execute();
    ```
  </CodeSample>

  <CodeSample value="ruby_native" lang="ruby">
    ```ruby
    require 'uri'
    require 'net/http'
    require 'openssl'
    
    url = URI("https://einvoice-api.sepay.vn/v1/invoices/084e179d-d95a-11f0-aef4-52c7e9b4f41b")
    
    http = Net::HTTP.new(url.host, url.port)
    http.use_ssl = true
    http.verify_mode = OpenSSL::SSL::VERIFY_NONE
    
    request = Net::HTTP::Get.new(url)
    request["Authorization"] = 'Bearer REPLACE_BEARER_TOKEN'
    
    response = http.request(request)
    puts response.read_body
    ```
  </CodeSample>

  <CodeSample value="go_native" lang="go">
    ```go
    package main
    
    import (
    	"fmt"
    	"net/http"
    	"io/ioutil"
    )
    
    func main() {
    
    	url := "https://einvoice-api.sepay.vn/v1/invoices/084e179d-d95a-11f0-aef4-52c7e9b4f41b"
    
    	req, _ := http.NewRequest("GET", url, nil)
    
    	req.Header.Add("Authorization", "Bearer REPLACE_BEARER_TOKEN")
    
    	res, _ := http.DefaultClient.Do(req)
    
    	defer res.Body.Close()
    	body, _ := ioutil.ReadAll(res.Body)
    
    	fmt.Println(res)
    	fmt.Println(string(body))
    
    }
    ```
  </CodeSample>

  <CodeSample value="csharp_httpclient" lang="csharp">
    ```csharp
    var client = new HttpClient();
    var request = new HttpRequestMessage
    {
        Method = HttpMethod.Get,
        RequestUri = new Uri("https://einvoice-api.sepay.vn/v1/invoices/084e179d-d95a-11f0-aef4-52c7e9b4f41b"),
        Headers =
        {
            { "Authorization", "Bearer REPLACE_BEARER_TOKEN" },
        },
    };
    using (var response = await client.SendAsync(request))
    {
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadAsStringAsync();
        Console.WriteLine(body);
    }
    ```
  </CodeSample>

  <CodeSample value="swift_nsurlsession" lang="swift">
    ```swift
    import Foundation
    
    let headers = ["Authorization": "Bearer REPLACE_BEARER_TOKEN"]
    
    let request = NSMutableURLRequest(url: NSURL(string: "https://einvoice-api.sepay.vn/v1/invoices/084e179d-d95a-11f0-aef4-52c7e9b4f41b")! as URL,
                                            cachePolicy: .useProtocolCachePolicy,
                                        timeoutInterval: 10.0)
    request.httpMethod = "GET"
    request.allHTTPHeaderFields = headers
    
    let session = URLSession.shared
    let dataTask = session.dataTask(with: request as URLRequest, completionHandler: { (data, response, error) -> Void in
      if (error != nil) {
        print(error)
      } else {
        let httpResponse = response as? HTTPURLResponse
        print(httpResponse)
      }
    })
    
    dataTask.resume()
    ```
  </CodeSample>

  <CodeSample value="kotlin_okhttp" lang="kotlin">
    ```kotlin
    val client = OkHttpClient()
    
    val request = Request.Builder()
      .url("https://einvoice-api.sepay.vn/v1/invoices/084e179d-d95a-11f0-aef4-52c7e9b4f41b")
      .get()
      .addHeader("Authorization", "Bearer REPLACE_BEARER_TOKEN")
      .build()
    
    val response = client.newCall(request).execute()
    ```
  </CodeSample>

</CodeSamples>

#### Bước tiếp theo

Sau khi có thông tin chi tiết hóa đơn:

1. **[Tải hóa đơn](/vi/einvoice-api/tai-hoa-don)** - Sử dụng `reference_code` để tải file PDF hoặc XML của hóa đơn
2. **[Danh sách hóa đơn](/vi/einvoice-api/danh-sach-hoa-don)** - Quay lại danh sách để tra cứu các hóa đơn khác