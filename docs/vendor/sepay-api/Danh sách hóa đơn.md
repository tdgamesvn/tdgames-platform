# Danh sách hóa đơn

## API tra cứu danh sách hóa đơn điện tử theo phân trang, trả về thông tin hóa đơn kèm trạng thái và link tải.

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

  <Path>https://einvoice-api.sepay.vn/v1/invoices</Path>

  <Description>
    Danh sách hóa đơn
  </Description>

  <Authentication>
    bearerAuth
  </Authentication>
</Endpoint>

#### API Request

<Params>
  <QueryParams>
    <Param name="page" type="integer" required="false">
      Trang hiện tại (mặc định 1)
    </Param>
    <Param name="per_page" type="integer" required="false">
      Số bản ghi mỗi trang (mặc định 10)
    </Param>
  </QueryParams>

</Params>

<Callout type="info" title="Phân trang">
Sử dụng 
`page`
 để chỉ định trang cần lấy (mặc định là 1).
Sử dụng 
`per_page`
 để giới hạn số bản ghi mỗi trang (mặc định là 10, tối đa 100).
Response trả về 
`has_more: true`
 nếu còn dữ liệu ở trang tiếp theo.
</Callout>

#### API Response

<Responses>
  <Response status="200">
    <Description>
      Danh sách hóa đơn
    </Description>

    <Example>
      {
        "data": {
          "paging": {
            "per_page": 1,
            "total": 20,
            "has_more": true,
            "current_page": 1,
            "page_count": 20
          },
          "items": [
            {
              "reference_code": "9735f09d-d970-11f0-aef4-52c7e9b4f41b",
              "invoice_number": "0",
              "issued_date": "2025-12-15",
              "pdf_url": "https://beta-portalv2.mifi.vn/DownloadPDFCA.aspx?...",
              "xml_url": null,
              "status": "draft",
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
              "notes": "Ghi chú hóa đơn"
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
      <Field name="data" type="object" required="false">
        <Fields>
          <Field name="paging" type="object" required="false">
            <Fields>
              <Field name="per_page" type="integer" required="false">
                Số bản ghi mỗi trang
              </Field>
              <Field name="total" type="integer" required="false">
                Tổng số bản ghi
              </Field>
              <Field name="has_more" type="boolean" required="false">
                Còn dữ liệu ở trang tiếp theo hay không
              </Field>
              <Field name="current_page" type="integer" required="false">
                Trang hiện tại
              </Field>
              <Field name="page_count" type="integer" required="false">
                Tổng số trang
              </Field>
            </Fields>
          </Field>
          <Field name="items" type="array" required="false">
            <ArrayItems>
              <Fields>
                <Field name="reference_code" type="string" required="false">
                  Mã tham chiếu hóa đơn
                </Field>
                <Field name="invoice_number" type="string" required="false">
                  Số hóa đơn (0 nếu là nháp)
                </Field>
                <Field name="issued_date" type="string" required="false">
                  Ngày phát hành (yyyy-MM-dd)
                </Field>
                <Field name="pdf_url" type="string" required="false">
                  Link tải PDF
                </Field>
                <Field name="xml_url" type="string" required="false">
                  Link tải XML (nếu có)
                </Field>
                <Field name="status" type="enum: draft, issued, cancelled" required="false">
                  Trạng thái hóa đơn (draft, issued...)
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
              </Fields>
            </ArrayItems>
          </Field>
        </Fields>
      </Field>
    </Fields>
  </ResponseSchema>

</ResponseDescriptionFields>

<Callout type="warning" title="Lưu ý về invoice_number">
`invoice_number`
 mặc định là 
`"0"`
 khi hóa đơn ở trạng thái nháp (
`"status": "draft"`
). Sau khi phát hành thành công, 
`invoice_number`
 sẽ được cập nhật thành số hóa đơn thực tế do nhà cung cấp cấp phát.
</Callout>

#### Xử lý lỗi

<ErrorCodes
  hiddenHead={true}
  rows={[
  { code: 401, name: "Unauthorized", description: "Thiếu hoặc sai Bearer token. Vui lòng kiểm tra lại token trong header Authorization." }
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
      --url 'https://einvoice-api.sepay.vn/v1/invoices?page=1&per_page=10' \
      --header 'Authorization: Bearer REPLACE_BEARER_TOKEN'
    ```
  </CodeSample>

  <CodeSample value="php_curl" lang="php">
    ```php
    <?php
    
    $curl = curl_init();
    
    curl_setopt_array($curl, [
      CURLOPT_URL => "https://einvoice-api.sepay.vn/v1/invoices?page=1&per_page=10",
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
    
    conn.request("GET", "/v1/invoices?page=1&per_page=10", headers=headers)
    
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
      "path": "/v1/invoices?page=1&per_page=10",
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
      .url("https://einvoice-api.sepay.vn/v1/invoices?page=1&per_page=10")
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
    
    url = URI("https://einvoice-api.sepay.vn/v1/invoices?page=1&per_page=10")
    
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
    
    	url := "https://einvoice-api.sepay.vn/v1/invoices?page=1&per_page=10"
    
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
        RequestUri = new Uri("https://einvoice-api.sepay.vn/v1/invoices?page=1&per_page=10"),
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
    
    let request = NSMutableURLRequest(url: NSURL(string: "https://einvoice-api.sepay.vn/v1/invoices?page=1&per_page=10")! as URL,
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
      .url("https://einvoice-api.sepay.vn/v1/invoices?page=1&per_page=10")
      .get()
      .addHeader("Authorization", "Bearer REPLACE_BEARER_TOKEN")
      .build()
    
    val response = client.newCall(request).execute()
    ```
  </CodeSample>

</CodeSamples>

#### Bước tiếp theo

Sau khi có danh sách hóa đơn, bạn có thể:

1. **[Chi tiết hóa đơn](/vi/einvoice-api/chi-tiet-hoa-don)** - Sử dụng `reference_code` để xem thông tin chi tiết một hóa đơn cụ thể
2. **[Tải hóa đơn](/vi/einvoice-api/tai-hoa-don)** - Tải file PDF hoặc XML của hóa đơn đã phát hành

<Callout type="info" title="Với hóa đơn nháp">
Nếu hóa đơn có 
`status: "draft"`
, bạn có thể 
Phát hành hóa đơn
 để phát hành chính thức.
</Callout>