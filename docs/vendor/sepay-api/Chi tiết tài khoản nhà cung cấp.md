# Chi tiết tài khoản nhà cung cấp

## API tra cứu chi tiết một tài khoản xuất hóa đơn điện tử trả về trạng thái và danh sách mẫu/ký hiệu hóa đơn được phép sử dụng

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

  <Path>https://einvoice-api.sepay.vn/v1/provider-accounts/{id}</Path>

  <Description>
    Chi tiết tài khoản nhà cung cấp
  </Description>

  <Authentication>
    bearerAuth
  </Authentication>
</Endpoint>

#### API Request

<Params>
  <PathParams>
    <Param name="id" type="string" required="true">
      ID tài khoản nhà cung cấp (UUID)
    </Param>
  </PathParams>

</Params>

#### API Response

<Responses>
  <Response status="200">
    <Description>
      Chi tiết tài khoản
    </Description>

    <Example>
      {
        "success": true,
        "data": {
          "id": "0aea3134-da40-11f0-aef4-52c7e9b4f41b",
          "provider": "matbao",
          "active": true,
          "templates": [
            {
              "template_code": "1",
              "invoice_series": "C25TAT",
              "invoice_label": "1 - C25TAT - Hóa đơn giá trị gia tăng"
            },
            {
              "template_code": "2",
              "invoice_series": "C25TMB",
              "invoice_label": "2 - C25TMB - Hóa đơn bán hàng"
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
          <Field name="id" type="string" required="false">
            ID tài khoản (UUID)
          </Field>
          <Field name="provider" type="string" required="false">
            Mã nhà cung cấp (matbao, bkav...)
          </Field>
          <Field name="active" type="boolean" required="false">
            Trạng thái kích hoạt tài khoản
          </Field>
          <Field name="templates" type="array" required="false">
            <Description>Danh sách mẫu/ký hiệu được cấp</Description>
            <ArrayItems>
              <Fields>
                <Field name="template_code" type="string" required="false">
                  Mã mẫu hóa đơn
                </Field>
                <Field name="invoice_series" type="string" required="false">
                  Ký hiệu hóa đơn tương ứng
                </Field>
                <Field name="invoice_label" type="string" required="false">
                  Nhãn hiển thị đầy đủ để chọn trong giao diện
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
  { code: 401, name: "Unauthorized", description: "Thiếu hoặc sai Bearer token." },
  { code: 404, name: "Not Found", description: "Không tồn tại tài khoản với ID cung cấp." }
]}
/>

#### Lưu ý

<Callout type="info" title="Lưu ý">
Lấy 
`id`
 từ 
API danh sách tài khoản nhà cung cấp
 để tra cứu chi tiết.
Sử dụng 
`template_code`
 và 
`invoice_series`
 từ danh sách 
`templates`
 khi 
tạo hóa đơn điện tử
.
Các mẫu hóa đơn phổ biến:
Hóa đơn giá trị gia tăng
 (VAT invoice)
Hóa đơn bán hàng
 (Sales invoice)
Phiếu xuất kho kiêm vận chuyển nội bộ
Biên lai điện tử
</Callout>

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
      --url https://einvoice-api.sepay.vn/v1/provider-accounts/0aea3134-da40-11f0-aef4-52c7e9b4f41b \
      --header 'Authorization: Bearer REPLACE_BEARER_TOKEN'
    ```
  </CodeSample>

  <CodeSample value="php_curl" lang="php">
    ```php
    <?php
    
    $curl = curl_init();
    
    curl_setopt_array($curl, [
      CURLOPT_URL => "https://einvoice-api.sepay.vn/v1/provider-accounts/0aea3134-da40-11f0-aef4-52c7e9b4f41b",
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
    
    conn.request("GET", "/v1/provider-accounts/0aea3134-da40-11f0-aef4-52c7e9b4f41b", headers=headers)
    
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
      "path": "/v1/provider-accounts/0aea3134-da40-11f0-aef4-52c7e9b4f41b",
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
      .url("https://einvoice-api.sepay.vn/v1/provider-accounts/0aea3134-da40-11f0-aef4-52c7e9b4f41b")
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
    
    url = URI("https://einvoice-api.sepay.vn/v1/provider-accounts/0aea3134-da40-11f0-aef4-52c7e9b4f41b")
    
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
    
    	url := "https://einvoice-api.sepay.vn/v1/provider-accounts/0aea3134-da40-11f0-aef4-52c7e9b4f41b"
    
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
        RequestUri = new Uri("https://einvoice-api.sepay.vn/v1/provider-accounts/0aea3134-da40-11f0-aef4-52c7e9b4f41b"),
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
    
    let request = NSMutableURLRequest(url: NSURL(string: "https://einvoice-api.sepay.vn/v1/provider-accounts/0aea3134-da40-11f0-aef4-52c7e9b4f41b")! as URL,
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
      .url("https://einvoice-api.sepay.vn/v1/provider-accounts/0aea3134-da40-11f0-aef4-52c7e9b4f41b")
      .get()
      .addHeader("Authorization", "Bearer REPLACE_BEARER_TOKEN")
      .build()
    
    val response = client.newCall(request).execute()
    ```
  </CodeSample>

</CodeSamples>

#### Bước tiếp theo

Sau khi có thông tin chi tiết tài khoản (bao gồm `template_code` và `invoice_series`), bạn có thể:

1. **[Xuất hóa đơn điện tử](/vi/einvoice-api/xuat-hoa-don-dien-tu)** - Sử dụng thông tin mẫu hóa đơn và ký hiệu từ tài khoản này để tạo hóa đơn