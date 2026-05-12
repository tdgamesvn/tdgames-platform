# Tạo hóa đơn điện tử

## API tạo hóa đơn điện tử nhận dữ liệu hóa đơn, ký số và gửi lên CQT, trả về mã tra cứu. Dùng mã tra cứu để kiểm tra trạng thái hóa đơn.

---

**API Overview:**

API tạo và quản lý hóa đơn điện tử theo quy định của Tổng cục Thuế Việt Nam.

**Base URLs:**
- Production: `https://einvoice-api.sepay.vn`
- Sandbox: `https://einvoice-api-sandbox.sepay.vn`


---

<ButtonLink href="/vi/einvoice-demo" variant="link">Xem hóa đơn demo</ButtonLink>

#### API Endpoint

<Endpoint>
  <Method>POST</Method>

  <Path>https://einvoice-api.sepay.vn/v1/invoices/create</Path>

  <Description>
    Xuất hóa đơn điện tử
  </Description>

  <Authentication>
    bearerAuth
  </Authentication>
</Endpoint>

#### API Request

<Params>
  <RequestBody>
    <Fields>
      <Field name="template_code" type="string" required="true">
        Mã mẫu hóa đơn (lấy từ API chi tiết tài khoản)
      </Field>
      <Field name="invoice_series" type="string" required="true">
        Ký hiệu hóa đơn (lấy từ API chi tiết tài khoản)
      </Field>
      <Field name="issued_date" type="string" required="true">
        Ngày phát hành (YYYY-MM-DD HH:mm:ss)
      </Field>
      <Field name="currency" type="string" required="true">
        Đơn vị tiền tệ
      </Field>
      <Field name="provider_account_id" type="string" required="true">
        ID tài khoản nhà cung cấp (UUID)
      </Field>
      <Field name="payment_method" type="enum: TM, CK, TM/CK, KHAC" required="false">
        Phương thức thanh toán:
- TM: Tiền mặt (Cash)
- CK: Chuyển khoản (Bank transfer)
- TM/CK: Tiền mặt và chuyển khoản (Cash and bank transfer)
- KHAC: Khác (Other)

      </Field>
      <Field name="is_draft" type="boolean" required="false">
        - `true`: Xuất nháp (cần phát hành sau, không tính vào hạn ngạch)
- `false`: Xuất và phát hành luôn

      </Field>
      <Field name="buyer" type="object" required="true">
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
      <Field name="items" type="array" required="true">
        <Description>Danh sách hàng hóa/dịch vụ</Description>
        <ArrayItems>
          <Fields>
            <Field name="line_number" type="integer" required="true">
              Số thứ tự dòng
            </Field>
            <Field name="line_type" type="enum: 1, 2, 3, 4" required="true">
              Loại dòng hàng:
- 1: Hàng hóa/dịch vụ bình thường
- 2: Hàng khuyến mại
- 3: Chiết khấu thương mại
- 4: Ghi chú

            </Field>
            <Field name="item_code" type="string" required="false">
              Mã hàng hóa/dịch vụ
            </Field>
            <Field name="item_name" type="string" required="true">
              Tên hàng hóa/dịch vụ
            </Field>
            <Field name="unit" type="string" required="false">
              Đơn vị tính
            </Field>
            <Field name="quantity" type="number" required="false">
              Số lượng
            </Field>
            <Field name="unit_price" type="number" required="false">
              Đơn giá
            </Field>
            <Field name="tax_rate" type="enum: -2, -1, 0, 5, 8, 10" required="false">
              Thuế suất (%):
- -2: Không chịu thuế
- -1: Không kê khai, tính nộp thuế GTGT
- 0: 0%
- 5: 5%
- 8: 8%
- 10: 10%

            </Field>
            <Field name="discount_tax" type="number" required="false">
              Phần trăm chiết khấu trên sản phẩm (%)
            </Field>
            <Field name="discount_amount" type="number" required="false">
              Số tiền chiết khấu trên sản phẩm
            </Field>
            <Field name="before_discount_and_tax_amount" type="number" required="false">
              Số tiền trước chiết khấu và thuế (dùng cho line_type=3)
            </Field>
          </Fields>
        </ArrayItems>
      </Field>
      <Field name="notes" type="string" required="false">
        Ghi chú nội bộ
      </Field>
    </Fields>

    <Example>
      {
        "template_code": "2",
        "invoice_series": "C25HTV",
        "issued_date": "2025-12-11 08:00:00",
        "currency": "VND",
        "provider_account_id": "0aea3134-da40-11f0-aef4-52c7e9b4f41b",
        "buyer": {
          "name": "Công ty ABC",
          "tax_code": "0101234567",
          "address": "123 Đường A, Quận B, Hà Nội",
          "email": "buyer@example.com",
          "phone": "0900000000"
        },
        "items": [
          {
            "line_number": 1,
            "line_type": 1,
            "item_code": "SP001",
            "item_name": "Sản phẩm A",
            "unit": "cái",
            "quantity": 1,
            "unit_price": 4500000
          }
        ],
        "notes": "Ghi chú hóa đơn",
        "is_draft": true
      }
    </Example>
  </RequestBody>
</Params>

#### API Response

<Responses>
  <Response status="200">
    <Description>
      Yêu cầu xuất hóa đơn đã được tiếp nhận
    </Description>

    <Example>
      {
        "success": true,
        "data": {
          "tracking_code": "084e179d-d95a-11f0-aef4-52c7e9b4f41b",
          "tracking_url": "https://einvoice-api.sepay.vn/v1/invoices/create/check/084e179d-d95a-11f0-aef4-52c7e9b4f41b",
          "message": "Đã tạo yêu cầu xuất bán hóa đơn điện tử"
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
          <Field name="tracking_code" type="string" required="true">
            Mã tracking để theo dõi trạng thái
          </Field>
          <Field name="tracking_url" type="string (uri)" required="true">
            URL để check trạng thái xử lý
          </Field>
          <Field name="message" type="string" required="false">
            Thông điệp phản hồi
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
  { code: 400, name: "Bad Request", description: "Missing or invalid required fields." },
  { code: 401, name: "Unauthorized", description: "Missing or invalid Bearer token." },
  { code: 500, name: "Internal Server Error", description: "System error while signing/submitting." }
]}
/>

#### Thông tin thuế suất

<Callout type="tip" title="Thông tin thuế suất">
`tax_rate`
 chỉ bắt buộc truyền khi dùng cho công ty (không cần truyền nếu sử dụng hoá đơn bán hàng)
Trường 
`tax_rate`
 trong 
`items`
 truyền dữ liệu theo như bên dưới:
`-2`
 (Không chịu thuế)
`-1`
 (Không kê khai, tính nộp thuế GTGT)
`0`
  (0% thuế suất)
`5`
  (5% thuế suất)
`8`
  (8% thuế suất)
`10`
 (10% thuế suất)
</Callout>

#### Lưu ý sử dụng

<Callout type="info" title="Lưu ý chung">
Để phát hành, gửi 
`is_draft=false`
. Nếu chỉ lưu nháp để xem trước, gửi 
`is_draft=true`
 (Nếu chỉ xuất hóa đơn nháp thì sẽ không bị tính vào hạn ngạch hóa đơn điện tử của bạn).
`provider_account_id`
 được cung cấp từ 
API danh sách tài khoản hóa đơn điện tử
Sau khi gửi yêu cầu xuất hóa đơn thành công, sử dụng endpoint được cung cấp qua 
`tracking_url`
 để gọi 
api theo dõi trạng thái xuất hóa đơn
</Callout>

<Callout type="info" title="Thêm ghi chú trên mẫu hoá đơn">
Nếu bạn muốn hiển thị ghi chú trên hoá đơn thì cần thêm môt item với 
`line_type:4`
 vào 
`items (array)`
, định dạng item line như bên dưới
```json
{
  "line_number": 3,
  "line_type": 4,
  "item_name": "Hàng tặng không thu tiền (Đây là ghi chú của bạn)"
}
```
</Callout>

<Callout type="info" title="Cách tính khuyến mại vào tổng tiền">
Khi truyền một dòng khuyến mại với 
`line_type = 2`
, mặc định giá trị sẽ bằng 0 và không được tính vào tổng tiền hóa đơn.
Nếu muốn hàng khuyến mại được tính vào tổng tiền, bạn cần truyền vào giá trị unit_price hoặc các field liên quan đến giá khác (giống như 
`line_type = 1`
) lớn hơn 0.
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
    curl --request POST \
      --url https://einvoice-api.sepay.vn/v1/invoices/create \
      --header 'Authorization: Bearer REPLACE_BEARER_TOKEN' \
      --header 'content-type: application/json' \
      --data '{"template_code":"1","invoice_series":"C26TSE","issued_date":"2026-01-26 00:00:00","currency":"VND","provider_account_id":"0aea3134-da40-11f0-aef4-52c7e9b4f41b","payment_method":"TM","is_draft":false,"buyer":{"type":"personal","name":"Công ty TNHH ABC","legal_name":"CÔNG TY CỔ PHẦN ABC","tax_code":"0123456789","address":"123 Đường ABC, Quận 1, TP.HCM","email":"contact@abc.com","phone":"0901234567","buyer_code":"KH-001","national_id":"001234567890"},"items":[{"line_number":1,"line_type":1,"item_code":"SP001","item_name":"Sản phẩm A","unit":"cái","quantity":10,"unit_price":100000,"tax_rate":10,"discount_tax":10,"discount_amount":100000,"before_discount_and_tax_amount":4500000}],"notes":"Ghi chú nội bộ"}'
    ```
  </CodeSample>

  <CodeSample value="php_curl" lang="php">
    ```php
    <?php
    
    $curl = curl_init();
    
    curl_setopt_array($curl, [
      CURLOPT_URL => "https://einvoice-api.sepay.vn/v1/invoices/create",
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_ENCODING => "",
      CURLOPT_MAXREDIRS => 10,
      CURLOPT_TIMEOUT => 30,
      CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
      CURLOPT_CUSTOMREQUEST => "POST",
      CURLOPT_POSTFIELDS => "{\"template_code\":\"1\",\"invoice_series\":\"C26TSE\",\"issued_date\":\"2026-01-26 00:00:00\",\"currency\":\"VND\",\"provider_account_id\":\"0aea3134-da40-11f0-aef4-52c7e9b4f41b\",\"payment_method\":\"TM\",\"is_draft\":false,\"buyer\":{\"type\":\"personal\",\"name\":\"Công ty TNHH ABC\",\"legal_name\":\"CÔNG TY CỔ PHẦN ABC\",\"tax_code\":\"0123456789\",\"address\":\"123 Đường ABC, Quận 1, TP.HCM\",\"email\":\"contact@abc.com\",\"phone\":\"0901234567\",\"buyer_code\":\"KH-001\",\"national_id\":\"001234567890\"},\"items\":[{\"line_number\":1,\"line_type\":1,\"item_code\":\"SP001\",\"item_name\":\"Sản phẩm A\",\"unit\":\"cái\",\"quantity\":10,\"unit_price\":100000,\"tax_rate\":10,\"discount_tax\":10,\"discount_amount\":100000,\"before_discount_and_tax_amount\":4500000}],\"notes\":\"Ghi chú nội bộ\"}",
      CURLOPT_HTTPHEADER => [
        "Authorization: Bearer REPLACE_BEARER_TOKEN",
        "content-type: application/json"
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
    
    payload = "{\"template_code\":\"1\",\"invoice_series\":\"C26TSE\",\"issued_date\":\"2026-01-26 00:00:00\",\"currency\":\"VND\",\"provider_account_id\":\"0aea3134-da40-11f0-aef4-52c7e9b4f41b\",\"payment_method\":\"TM\",\"is_draft\":false,\"buyer\":{\"type\":\"personal\",\"name\":\"Công ty TNHH ABC\",\"legal_name\":\"CÔNG TY CỔ PHẦN ABC\",\"tax_code\":\"0123456789\",\"address\":\"123 Đường ABC, Quận 1, TP.HCM\",\"email\":\"contact@abc.com\",\"phone\":\"0901234567\",\"buyer_code\":\"KH-001\",\"national_id\":\"001234567890\"},\"items\":[{\"line_number\":1,\"line_type\":1,\"item_code\":\"SP001\",\"item_name\":\"Sản phẩm A\",\"unit\":\"cái\",\"quantity\":10,\"unit_price\":100000,\"tax_rate\":10,\"discount_tax\":10,\"discount_amount\":100000,\"before_discount_and_tax_amount\":4500000}],\"notes\":\"Ghi chú nội bộ\"}"
    
    headers = {
        'Authorization': "Bearer REPLACE_BEARER_TOKEN",
        'content-type': "application/json"
        }
    
    conn.request("POST", "/v1/invoices/create", payload, headers)
    
    res = conn.getresponse()
    data = res.read()
    
    print(data.decode("utf-8"))
    ```
  </CodeSample>

  <CodeSample value="node_native" lang="javascript">
    ```javascript
    const http = require("https");
    
    const options = {
      "method": "POST",
      "hostname": "einvoice-api.sepay.vn",
      "port": null,
      "path": "/v1/invoices/create",
      "headers": {
        "Authorization": "Bearer REPLACE_BEARER_TOKEN",
        "content-type": "application/json"
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
    
    req.write(JSON.stringify({
      template_code: '1',
      invoice_series: 'C26TSE',
      issued_date: '2026-01-26 00:00:00',
      currency: 'VND',
      provider_account_id: '0aea3134-da40-11f0-aef4-52c7e9b4f41b',
      payment_method: 'TM',
      is_draft: false,
      buyer: {
        type: 'personal',
        name: 'Công ty TNHH ABC',
        legal_name: 'CÔNG TY CỔ PHẦN ABC',
        tax_code: '0123456789',
        address: '123 Đường ABC, Quận 1, TP.HCM',
        email: 'contact@abc.com',
        phone: '0901234567',
        buyer_code: 'KH-001',
        national_id: '001234567890'
      },
      items: [
        {
          line_number: 1,
          line_type: 1,
          item_code: 'SP001',
          item_name: 'Sản phẩm A',
          unit: 'cái',
          quantity: 10,
          unit_price: 100000,
          tax_rate: 10,
          discount_tax: 10,
          discount_amount: 100000,
          before_discount_and_tax_amount: 4500000
        }
      ],
      notes: 'Ghi chú nội bộ'
    }));
    req.end();
    ```
  </CodeSample>

  <CodeSample value="java_okhttp" lang="java">
    ```java
    OkHttpClient client = new OkHttpClient();
    
    MediaType mediaType = MediaType.parse("application/json");
    RequestBody body = RequestBody.create(mediaType, "{\"template_code\":\"1\",\"invoice_series\":\"C26TSE\",\"issued_date\":\"2026-01-26 00:00:00\",\"currency\":\"VND\",\"provider_account_id\":\"0aea3134-da40-11f0-aef4-52c7e9b4f41b\",\"payment_method\":\"TM\",\"is_draft\":false,\"buyer\":{\"type\":\"personal\",\"name\":\"Công ty TNHH ABC\",\"legal_name\":\"CÔNG TY CỔ PHẦN ABC\",\"tax_code\":\"0123456789\",\"address\":\"123 Đường ABC, Quận 1, TP.HCM\",\"email\":\"contact@abc.com\",\"phone\":\"0901234567\",\"buyer_code\":\"KH-001\",\"national_id\":\"001234567890\"},\"items\":[{\"line_number\":1,\"line_type\":1,\"item_code\":\"SP001\",\"item_name\":\"Sản phẩm A\",\"unit\":\"cái\",\"quantity\":10,\"unit_price\":100000,\"tax_rate\":10,\"discount_tax\":10,\"discount_amount\":100000,\"before_discount_and_tax_amount\":4500000}],\"notes\":\"Ghi chú nội bộ\"}");
    Request request = new Request.Builder()
      .url("https://einvoice-api.sepay.vn/v1/invoices/create")
      .post(body)
      .addHeader("Authorization", "Bearer REPLACE_BEARER_TOKEN")
      .addHeader("content-type", "application/json")
      .build();
    
    Response response = client.newCall(request).execute();
    ```
  </CodeSample>

  <CodeSample value="ruby_native" lang="ruby">
    ```ruby
    require 'uri'
    require 'net/http'
    require 'openssl'
    
    url = URI("https://einvoice-api.sepay.vn/v1/invoices/create")
    
    http = Net::HTTP.new(url.host, url.port)
    http.use_ssl = true
    http.verify_mode = OpenSSL::SSL::VERIFY_NONE
    
    request = Net::HTTP::Post.new(url)
    request["Authorization"] = 'Bearer REPLACE_BEARER_TOKEN'
    request["content-type"] = 'application/json'
    request.body = "{\"template_code\":\"1\",\"invoice_series\":\"C26TSE\",\"issued_date\":\"2026-01-26 00:00:00\",\"currency\":\"VND\",\"provider_account_id\":\"0aea3134-da40-11f0-aef4-52c7e9b4f41b\",\"payment_method\":\"TM\",\"is_draft\":false,\"buyer\":{\"type\":\"personal\",\"name\":\"Công ty TNHH ABC\",\"legal_name\":\"CÔNG TY CỔ PHẦN ABC\",\"tax_code\":\"0123456789\",\"address\":\"123 Đường ABC, Quận 1, TP.HCM\",\"email\":\"contact@abc.com\",\"phone\":\"0901234567\",\"buyer_code\":\"KH-001\",\"national_id\":\"001234567890\"},\"items\":[{\"line_number\":1,\"line_type\":1,\"item_code\":\"SP001\",\"item_name\":\"Sản phẩm A\",\"unit\":\"cái\",\"quantity\":10,\"unit_price\":100000,\"tax_rate\":10,\"discount_tax\":10,\"discount_amount\":100000,\"before_discount_and_tax_amount\":4500000}],\"notes\":\"Ghi chú nội bộ\"}"
    
    response = http.request(request)
    puts response.read_body
    ```
  </CodeSample>

  <CodeSample value="go_native" lang="go">
    ```go
    package main
    
    import (
    	"fmt"
    	"strings"
    	"net/http"
    	"io/ioutil"
    )
    
    func main() {
    
    	url := "https://einvoice-api.sepay.vn/v1/invoices/create"
    
    	payload := strings.NewReader("{\"template_code\":\"1\",\"invoice_series\":\"C26TSE\",\"issued_date\":\"2026-01-26 00:00:00\",\"currency\":\"VND\",\"provider_account_id\":\"0aea3134-da40-11f0-aef4-52c7e9b4f41b\",\"payment_method\":\"TM\",\"is_draft\":false,\"buyer\":{\"type\":\"personal\",\"name\":\"Công ty TNHH ABC\",\"legal_name\":\"CÔNG TY CỔ PHẦN ABC\",\"tax_code\":\"0123456789\",\"address\":\"123 Đường ABC, Quận 1, TP.HCM\",\"email\":\"contact@abc.com\",\"phone\":\"0901234567\",\"buyer_code\":\"KH-001\",\"national_id\":\"001234567890\"},\"items\":[{\"line_number\":1,\"line_type\":1,\"item_code\":\"SP001\",\"item_name\":\"Sản phẩm A\",\"unit\":\"cái\",\"quantity\":10,\"unit_price\":100000,\"tax_rate\":10,\"discount_tax\":10,\"discount_amount\":100000,\"before_discount_and_tax_amount\":4500000}],\"notes\":\"Ghi chú nội bộ\"}")
    
    	req, _ := http.NewRequest("POST", url, payload)
    
    	req.Header.Add("Authorization", "Bearer REPLACE_BEARER_TOKEN")
    	req.Header.Add("content-type", "application/json")
    
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
        Method = HttpMethod.Post,
        RequestUri = new Uri("https://einvoice-api.sepay.vn/v1/invoices/create"),
        Headers =
        {
            { "Authorization", "Bearer REPLACE_BEARER_TOKEN" },
        },
        Content = new StringContent("{\"template_code\":\"1\",\"invoice_series\":\"C26TSE\",\"issued_date\":\"2026-01-26 00:00:00\",\"currency\":\"VND\",\"provider_account_id\":\"0aea3134-da40-11f0-aef4-52c7e9b4f41b\",\"payment_method\":\"TM\",\"is_draft\":false,\"buyer\":{\"type\":\"personal\",\"name\":\"Công ty TNHH ABC\",\"legal_name\":\"CÔNG TY CỔ PHẦN ABC\",\"tax_code\":\"0123456789\",\"address\":\"123 Đường ABC, Quận 1, TP.HCM\",\"email\":\"contact@abc.com\",\"phone\":\"0901234567\",\"buyer_code\":\"KH-001\",\"national_id\":\"001234567890\"},\"items\":[{\"line_number\":1,\"line_type\":1,\"item_code\":\"SP001\",\"item_name\":\"Sản phẩm A\",\"unit\":\"cái\",\"quantity\":10,\"unit_price\":100000,\"tax_rate\":10,\"discount_tax\":10,\"discount_amount\":100000,\"before_discount_and_tax_amount\":4500000}],\"notes\":\"Ghi chú nội bộ\"}")
        {
            Headers =
            {
                ContentType = new MediaTypeHeaderValue("application/json")
            }
        }
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
    
    let headers = [
      "Authorization": "Bearer REPLACE_BEARER_TOKEN",
      "content-type": "application/json"
    ]
    let parameters = [
      "template_code": "1",
      "invoice_series": "C26TSE",
      "issued_date": "2026-01-26 00:00:00",
      "currency": "VND",
      "provider_account_id": "0aea3134-da40-11f0-aef4-52c7e9b4f41b",
      "payment_method": "TM",
      "is_draft": false,
      "buyer": [
        "type": "personal",
        "name": "Công ty TNHH ABC",
        "legal_name": "CÔNG TY CỔ PHẦN ABC",
        "tax_code": "0123456789",
        "address": "123 Đường ABC, Quận 1, TP.HCM",
        "email": "contact@abc.com",
        "phone": "0901234567",
        "buyer_code": "KH-001",
        "national_id": "001234567890"
      ],
      "items": [
        [
          "line_number": 1,
          "line_type": 1,
          "item_code": "SP001",
          "item_name": "Sản phẩm A",
          "unit": "cái",
          "quantity": 10,
          "unit_price": 100000,
          "tax_rate": 10,
          "discount_tax": 10,
          "discount_amount": 100000,
          "before_discount_and_tax_amount": 4500000
        ]
      ],
      "notes": "Ghi chú nội bộ"
    ] as [String : Any]
    
    let postData = JSONSerialization.data(withJSONObject: parameters, options: [])
    
    let request = NSMutableURLRequest(url: NSURL(string: "https://einvoice-api.sepay.vn/v1/invoices/create")! as URL,
                                            cachePolicy: .useProtocolCachePolicy,
                                        timeoutInterval: 10.0)
    request.httpMethod = "POST"
    request.allHTTPHeaderFields = headers
    request.httpBody = postData as Data
    
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
    
    val mediaType = MediaType.parse("application/json")
    val body = RequestBody.create(mediaType, "{\"template_code\":\"1\",\"invoice_series\":\"C26TSE\",\"issued_date\":\"2026-01-26 00:00:00\",\"currency\":\"VND\",\"provider_account_id\":\"0aea3134-da40-11f0-aef4-52c7e9b4f41b\",\"payment_method\":\"TM\",\"is_draft\":false,\"buyer\":{\"type\":\"personal\",\"name\":\"Công ty TNHH ABC\",\"legal_name\":\"CÔNG TY CỔ PHẦN ABC\",\"tax_code\":\"0123456789\",\"address\":\"123 Đường ABC, Quận 1, TP.HCM\",\"email\":\"contact@abc.com\",\"phone\":\"0901234567\",\"buyer_code\":\"KH-001\",\"national_id\":\"001234567890\"},\"items\":[{\"line_number\":1,\"line_type\":1,\"item_code\":\"SP001\",\"item_name\":\"Sản phẩm A\",\"unit\":\"cái\",\"quantity\":10,\"unit_price\":100000,\"tax_rate\":10,\"discount_tax\":10,\"discount_amount\":100000,\"before_discount_and_tax_amount\":4500000}],\"notes\":\"Ghi chú nội bộ\"}")
    val request = Request.Builder()
      .url("https://einvoice-api.sepay.vn/v1/invoices/create")
      .post(body)
      .addHeader("Authorization", "Bearer REPLACE_BEARER_TOKEN")
      .addHeader("content-type", "application/json")
      .build()
    
    val response = client.newCall(request).execute()
    ```
  </CodeSample>

</CodeSamples>

***

#### Tham số mẫu cho các loại hoá đơn

##### Mẫu hoá đơn bán hàng

<Response title="json">
```json
  {
      "template_code": "2",
      "invoice_series": "C25HTV",
      "issued_date": "2025-12-11 08:00:00",
      "currency": "VND",
      "provider_account_id": "{{your-provider-account-id}}",
      "buyer": {
          "name": "Công ty ABC",
          "tax_code": "0101234567",
          "address": "123 Đường A, Quận B, Hà Nội",
          "email": "buyer@example.com",
          "phone": "0900000000",
          "buyer_code": "KH-001",
          "national_id": "001234567890"
      },
      "items": [
          {
          "line_number": 1,
          "line_type": 1,
          "item_code": "SP001",
          "item_name": "Sản phẩm A",
          "unit": "cái",
          "quantity": 1,
          "unit_price": 4500000
          }
      ],
      "notes": "Ghi chú hóa đơn",
      "is_draft": true
  }
```
</Response>

##### Mẫu hóa đơn bán hàng có chiết khấu trên tổng đơn

<Response title="json">
```json
{
  "template_code": "2",
  "invoice_series": "C26TSP",
  "issued_date": "2026-01-26 00:00:00",
  "currency": "VND",
  "provider_account_id": "{{your-provider-account-id}}",
  "buyer": {
      "type": "personal",
      "name": "Buyer Name Demo",
      "legal_name": "CÔNG TY CỔ PHẦN ABC",
      "tax_code": "0317887567",
      "address": "Số 88 Đường Ánh Sao, Phường Bình An, Quận 9, TP Hồ Chí Minh, Việt Nam",
      "email": "buyeremaildemo@gmail.com"
  },
  "items": [
      {
          "line_number": 1,
          "line_type": 1,
          "item_code": "SP001",
          "item_name": "Sản phẩm A",
          "unit": "cái",
          "quantity": 1,
          "unit_price": 4500000
      },
      {
          "line_number": 2,
          "line_type": 3,
          "item_name": "Chiết khấu thương mại",
          "before_discount_and_tax_amount": 4500000
      }
  ],
  "notes": "Ghi chú hóa đơn",
  "payment_method": "TM/CK",
  "is_draft": false
}
```
</Response>

##### Mẫu hóa đơn bán hàng có chiết khấu trên sản phẩm (theo phần trăm giảm giá - discount\_tax)

<Response title="json">
```json
{
  "template_code": "2",
  "invoice_series": "C26TSP",
  "issued_date": "2026-01-26 00:00:00",
  "currency": "VND",
  "provider_account_id": "{{your-provider-account-id}}",
  "buyer": {
      "type": "personal",
      "name": "Buyer Name Demo",
      "legal_name": "CÔNG TY CỔ PHẦN ABC",
      "tax_code": "0317887567",
      "address": "Số 88 Đường Ánh Sao, Phường Bình An, Quận 9, TP Hồ Chí Minh, Việt Nam",
      "email": "buyeremaildemo@gmail.com"
  },
  "items": [
      {
          "line_number": 1,
          "line_type": 1,
          "item_code": "SP001",
          "item_name": "Sản phẩm A",
          "unit": "cái",
          "quantity": 1,
          "unit_price": 4500000,
          "discount_tax": 2
      }
  ],
  "notes": "Ghi chú hóa đơn",
  "payment_method": "TM",
  "is_draft": false
}
```
</Response>

##### Mẫu hóa đơn bán hàng có chiết khấu trên sản phẩm (theo số tiền giảm giá - discount\_amount)

<Response title="json">
```json
{
  "template_code": "2",
  "invoice_series": "C26TSP",
  "issued_date": "2026-01-26 00:00:00",
  "currency": "VND",
  "provider_account_id": "{{your-provider-account-id}}",
  "buyer": {
      "type": "personal",
      "name": "Buyer Name Demo",
      "legal_name": "CÔNG TY CỔ PHẦN ABC",
      "tax_code": "0317887567",
      "address": "Số 88 Đường Ánh Sao, Phường Bình An, Quận 9, TP Hồ Chí Minh, Việt Nam",
      "email": "buyeremaildemo@gmail.com"
  },
  "items": [
      {
          "line_number": 1,
          "line_type": 1,
          "item_code": "SP001",
          "item_name": "Sản phẩm A",
          "unit": "cái",
          "quantity": 1,
          "unit_price": 4500000,
          "discount_amount": 100000
      }
  ],
  "notes": "Ghi chú hóa đơn",
  "payment_method": "CK",
  "is_draft": false
}
```
</Response>

##### Mẫu hóa đơn bán hàng có khuyến mãi

<Response title="json">
```json
{
  "template_code": "2",
  "invoice_series": "C25HTV",
  "issued_date": "2025-12-11 08:00:00",
  "currency": "VND",
  "provider_account_id": "{{your-provider-account-id}}",
  "buyer": {
      "name": "Công ty ABC",
      "tax_code": "0101234567",
      "address": "123 Đường A, Quận B, Hà Nội",
      "email": "buyer@example.com",
      "phone": "0900000000"
  },
  "items": [
      {
          "line_number": 1,
          "line_type": 1,
          "item_code": "SP001",
          "item_name": "Sản phẩm A",
          "unit": "cái",
          "quantity": 1,
          "unit_price": 4500000
      },
      {
          "line_number": 2,
          "line_type": 2,
          "item_code": "KM001",
          "item_name": "Hàng KM",
          "unit": "cái",
          "quantity": 1,
          "unit_price": 0
      }
  ],
  "notes": "Ghi chú hóa đơn",
  "payment_method": "TM",
  "is_draft": true
}
```
</Response>

##### Mẫu hóa đơn giá trị gia tăng

<Response title="json">
```json
{
  "template_code": "1",
  "invoice_series": "C26TSE",
  "issued_date": "2026-01-26 00:00:00",
  "currency": "VND",
  "provider_account_id": "{{your-provider-account-id}}",
  "buyer": {
      "type": "personal",
      "name": "Buyer Name Demo",
      "legal_name": "CÔNG TY CỔ PHẦN ABC",
      "tax_code": "0317887567",
      "address": "Số 88 Đường Ánh Sao, Phường Bình An, Quận 9, TP Hồ Chí Minh, Việt Nam",
      "email": "buyeremaildemo@gmail.com"
  },
  "items": [
      {
          "line_number": 1,
          "line_type": 1,
          "item_code": "SP001",
          "item_name": "Sản phẩm A",
          "unit": "cái",
          "quantity": 1,
          "unit_price": 4500000,
          "tax_rate": 10
      }
  ],
  "notes": "Ghi chú hóa đơn",
  "payment_method": "CK",
  "is_draft": false
}
```
</Response>

##### Mẫu hóa đơn giá trị gia tăng có chiết khấu trên tổng đơn

<Response title="json">
```json
{
  "template_code": "1",
  "invoice_series": "C26TSE",
  "issued_date": "2026-01-26 00:00:00",
  "currency": "VND",
  "provider_account_id": "{{your-provider-account-id}}",
  "buyer": {
      "type": "personal",
      "name": "Buyer Name Demo",
      "legal_name": "CÔNG TY CỔ PHẦN ABC",
      "tax_code": "0317887567",
      "address": "Số 88 Đường Ánh Sao, Phường Bình An, Quận 9, TP Hồ Chí Minh, Việt Nam",
      "email": "buyeremaildemo@gmail.com"
  },
  "items": [
      {
          "line_number": 1,
          "line_type": 1,
          "item_code": "SP001",
          "item_name": "Sản phẩm A",
          "unit": "cái",
          "quantity": 1,
          "unit_price": 4500000,
          "tax_rate": 10
      },
      {
          "line_number": 1,
          "line_type": 3,
          "item_name": "Chiết khấu thương mại",
          "tax_rate": 10,
          "before_discount_and_tax_amount": 100000
      }
  ],
  "notes": "Ghi chú hóa đơn",
  "payment_method": "TM/CK",
  "is_draft": false
}
```
</Response>

##### Mẫu hóa đơn giá trị gia tăng có chiết khấu trên sản phẩm (theo phần trăm giảm giá - discount\_tax)

<Response title="json">
```json
{
  "template_code": "1",
  "invoice_series": "C26TSE",
  "issued_date": "2026-01-26 00:00:00",
  "currency": "VND",
  "provider_account_id": "{{your-provider-account-id}}",
  "buyer": {
      "type": "personal",
      "name": "Buyer Name Demo",
      "legal_name": "CÔNG TY CỔ PHẦN ABC",
      "tax_code": "0317887567",
      "address": "Số 88 Đường Ánh Sao, Phường Bình An, Quận 9, TP Hồ Chí Minh, Việt Nam",
      "email": "buyeremaildemo@gmail.com"
  },
  "items": [
      {
          "line_number": 1,
          "line_type": 1,
          "item_code": "SP001",
          "item_name": "Sản phẩm A",
          "unit": "cái",
          "quantity": 1,
          "unit_price": 4500000,
          "tax_rate": 10,
          "discount_tax": 10
      }
  ],
  "notes": "Ghi chú hóa đơn",
  "payment_method": "CK",
  "is_draft": false
}
```
</Response>

##### Mẫu hóa đơn giá trị gia tăng có chiết khấu trên sản phẩm (theo số tiền giảm giá - discount\_amount)

<Response title="json">
```json
{
  "template_code": "1",
  "invoice_series": "C26TSE",
  "issued_date": "2026-01-26 00:00:00",
  "currency": "VND",
  "provider_account_id": "{{your-provider-account-id}}",
  "buyer": {
      "type": "personal",
      "name": "Buyer Name Demo",
      "legal_name": "CÔNG TY CỔ PHẦN ABC",
      "tax_code": "0317887567",
      "address": "Số 88 Đường Ánh Sao, Phường Bình An, Quận 9, TP Hồ Chí Minh, Việt Nam",
      "email": "buyeremaildemo@gmail.com"
  },
  "items": [
      {
          "line_number": 1,
          "line_type": 1,
          "item_code": "SP001",
          "item_name": "Sản phẩm A",
          "unit": "cái",
          "quantity": 1,
          "unit_price": 4500000,
          "tax_rate": 10,
          "discount_amount": 100000
      }
  ],
  "notes": "Ghi chú hóa đơn",
  "payment_method": "KHAC",
  "is_draft": false
}
```
</Response>

***

#### Bước tiếp theo

Sau khi gửi yêu cầu tạo hóa đơn thành công và nhận được `tracking_code`:

1. **[Theo dõi trạng thái xuất hóa đơn](/vi/einvoice-api/theo-doi-trang-thai-xuat-hoa-don)** - Sử dụng `tracking_code` để kiểm tra kết quả xử lý (bắt buộc)

<Callout type="info" title="Sau khi xác nhận trạng thái thành công">
Nếu xuất hóa đơn 
nháp
 (
`is_draft=true`
): Tiếp tục 
Phát hành hóa đơn
 để phát hành chính thức
Nếu xuất hóa đơn 
chính thức
 (
`is_draft=false`
): Có thể 
Tải hóa đơn
 hoặc 
Xem chi tiết hóa đơn
</Callout>