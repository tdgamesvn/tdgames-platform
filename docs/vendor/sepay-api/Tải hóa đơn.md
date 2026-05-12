\# Tải hóa đơn



\## API tải file hóa đơn (PDF hoặc XML) theo mã tracking code, trả về nội dung file dạng base64.



\---



\*\*API Overview:\*\*



API tạo và quản lý hóa đơn điện tử theo quy định của Tổng cục Thuế Việt Nam.



\*\*Base URLs:\*\*

\- Production: `https://einvoice-api.sepay.vn`

\- Sandbox: `https://einvoice-api-sandbox.sepay.vn`





\---



\#### API Endpoint



<Endpoint>

&#x20; <Method>GET</Method>



&#x20; <Path>https://einvoice-api.sepay.vn/v1/invoices/{tracking\_code}/download</Path>



&#x20; <Description>

&#x20;   Tải hóa đơn

&#x20; </Description>



&#x20; <Authentication>

&#x20;   bearerAuth

&#x20; </Authentication>

</Endpoint>



\#### API Request



<Params>

&#x20; <PathParams>

&#x20;   <Param name="tracking\_code" type="string" required="true">

&#x20;     Mã tracking của hóa đơn

&#x20;   </Param>

&#x20; </PathParams>



&#x20; <QueryParams>

&#x20;   <Param name="type" type="enum: pdf, xml" required="true">

&#x20;     Loại file cần tải (pdf hoặc xml)

&#x20;   </Param>

&#x20; </QueryParams>



</Params>



\#### API Response



<Responses>

&#x20; <Response status="200">

&#x20;   <Description>

&#x20;     File hóa đơn (base64 encoded)

&#x20;   </Description>



&#x20;   <Example>

&#x20;     {

&#x20;       "success": true,

&#x20;       "data": {

&#x20;         "file\_type": "pdf",

&#x20;         "file\_name": "HD\_0000589\_20251215.pdf",

&#x20;         "content": "JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC9UeXBlL1hPYmplY3Q..."

&#x20;       }

&#x20;     }

&#x20;   </Example>

&#x20; </Response>



</Responses>



<ResponseDescriptionFields>

&#x20; <ResponseSchema status="200">

&#x20;   <Fields>

&#x20;     <Field name="success" type="boolean" required="false">

&#x20;     </Field>

&#x20;     <Field name="data" type="object" required="false">

&#x20;       <Fields>

&#x20;         <Field name="file\_type" type="enum: pdf, xml" required="true">

&#x20;           Loại file được tải (pdf hoặc xml)

&#x20;         </Field>

&#x20;         <Field name="file\_name" type="string" required="true">

&#x20;           Tên file gợi ý khi lưu

&#x20;         </Field>

&#x20;         <Field name="content" type="string" required="true">

&#x20;           Nội dung file được mã hóa base64. Cần decode để lưu thành file.

&#x20;         </Field>

&#x20;       </Fields>

&#x20;     </Field>

&#x20;   </Fields>

&#x20; </ResponseSchema>



</ResponseDescriptionFields>



\#### Xử lý lỗi



<ErrorCodes

&#x20; hiddenHead={true}

&#x20; rows={\[

&#x20; { code: 400, name: "Bad Request", description: "Tham số type không hợp lệ (không phải pdf hoặc xml)." },

&#x20; { code: 401, name: "Unauthorized", description: "Thiếu hoặc sai Bearer token." },

&#x20; { code: 404, name: "Not Found", description: "Không tìm thấy hóa đơn theo tracking\_code." }

]}

/>



\#### Lưu ý



<Callout type="info" title="Lưu ý">

API trả về nội dung file dạng 

base64

. Bạn cần decode base64 để lưu thành file PDF hoặc XML.

Tham số 

`type`

&#x20;chỉ chấp nhận hai giá trị: 

`pdf`

&#x20;hoặc 

`xml`

.

Đảm bảo hóa đơn đã được phát hành thành công trước khi tải file.

</Callout>



\#### Xử lý Base64 thành File



Sau khi gọi API thành công, bạn cần decode nội dung base64 và lưu thành file. Dưới đây là ví dụ với PHP:



<Php title="Decode Base64 và lưu file">

```php

<?php

// Giả sử $response là kết quả từ API

$response = json\_decode($apiResult, true);



if ($response\['success']) {

&#x20; // Lấy nội dung base64 từ response

&#x20; $base64Content = $response\['data']\['content'];

&#x20; $fileName = $response\['data']\['file\_name'];



&#x20; // Decode base64 thành binary

&#x20; $binaryContent = base64\_decode($base64Content);



&#x20; // Kiểm tra decode thành công

&#x20; if ($binaryContent === false) {

&#x20;     throw new Exception('Lỗi decode base64');

&#x20; }



&#x20; // Lưu file

&#x20; $bytesWritten = file\_put\_contents($fileName, $binaryContent);



&#x20; if ($bytesWritten === false) {

&#x20;     throw new Exception('Lỗi ghi file');

&#x20; }



&#x20; echo "Đã lưu file: {$fileName} ({$bytesWritten} bytes)";

}

```

</Php>



\*\*Các bước xử lý:\*\*



1\. \*\*Parse JSON response\*\* - Chuyển đổi response thành mảng PHP

2\. \*\*Lấy nội dung base64\*\* - Truy cập `$response\['data']\['content']`

3\. \*\*Decode base64\*\* - Sử dụng `base64\_decode()` để chuyển thành binary

4\. \*\*Lưu file\*\* - Sử dụng `file\_put\_contents()` để ghi ra file



<Callout type="warning" title="Lưu ý quan trọng">

Luôn kiểm tra kết quả 

`base64\_decode()`

&#x20;vì có thể trả về 

`false`

&#x20;nếu chuỗi base64 không hợp lệ.

Đảm bảo thư mục lưu file có quyền ghi (write permission).

Với file PDF, có thể kiểm tra header 

`%PDF`

&#x20;sau khi decode để xác nhận file hợp lệ.

</Callout>



\#### Code mẫu



<CodeSamples>

&#x20; <CodeSamplesList>

&#x20;   <CodeSamplesTrigger value="shell\_curl">

&#x20;     cURL

&#x20;   </CodeSamplesTrigger>



&#x20;   <CodeSamplesTrigger value="php\_curl">

&#x20;     PHP

&#x20;   </CodeSamplesTrigger>



&#x20;   <CodeSamplesTrigger value="python\_python3">

&#x20;     Python

&#x20;   </CodeSamplesTrigger>



&#x20;   <CodeSamplesTrigger value="node\_native">

&#x20;     NodeJS

&#x20;   </CodeSamplesTrigger>



&#x20;   <CodeSamplesTrigger value="java\_okhttp">

&#x20;     Java

&#x20;   </CodeSamplesTrigger>



&#x20;   <CodeSamplesTrigger value="ruby\_native">

&#x20;     Ruby

&#x20;   </CodeSamplesTrigger>



&#x20;   <CodeSamplesTrigger value="go\_native">

&#x20;     Go

&#x20;   </CodeSamplesTrigger>



&#x20;   <CodeSamplesTrigger value="csharp\_httpclient">

&#x20;     .NET

&#x20;   </CodeSamplesTrigger>



&#x20;   <CodeSamplesTrigger value="swift\_nsurlsession">

&#x20;     Swift

&#x20;   </CodeSamplesTrigger>



&#x20;   <CodeSamplesTrigger value="kotlin\_okhttp">

&#x20;     Kotlin

&#x20;   </CodeSamplesTrigger>



&#x20; </CodeSamplesList>



&#x20; <CodeSample value="shell\_curl" lang="bash">

&#x20;   ```bash

&#x20;   curl --request GET \\

&#x20;     --url 'https://einvoice-api.sepay.vn/v1/invoices/084e179d-d95a-11f0-aef4-52c7e9b4f41b/download?type=pdf' \\

&#x20;     --header 'Authorization: Bearer REPLACE\_BEARER\_TOKEN'

&#x20;   ```

&#x20; </CodeSample>



&#x20; <CodeSample value="php\_curl" lang="php">

&#x20;   ```php

&#x20;   <?php

&#x20;   

&#x20;   $curl = curl\_init();

&#x20;   

&#x20;   curl\_setopt\_array($curl, \[

&#x20;     CURLOPT\_URL => "https://einvoice-api.sepay.vn/v1/invoices/084e179d-d95a-11f0-aef4-52c7e9b4f41b/download?type=pdf",

&#x20;     CURLOPT\_RETURNTRANSFER => true,

&#x20;     CURLOPT\_ENCODING => "",

&#x20;     CURLOPT\_MAXREDIRS => 10,

&#x20;     CURLOPT\_TIMEOUT => 30,

&#x20;     CURLOPT\_HTTP\_VERSION => CURL\_HTTP\_VERSION\_1\_1,

&#x20;     CURLOPT\_CUSTOMREQUEST => "GET",

&#x20;     CURLOPT\_HTTPHEADER => \[

&#x20;       "Authorization: Bearer REPLACE\_BEARER\_TOKEN"

&#x20;     ],

&#x20;   ]);

&#x20;   

&#x20;   $response = curl\_exec($curl);

&#x20;   $err = curl\_error($curl);

&#x20;   

&#x20;   curl\_close($curl);

&#x20;   

&#x20;   if ($err) {

&#x20;     echo "cURL Error #:" . $err;

&#x20;   } else {

&#x20;     echo $response;

&#x20;   }

&#x20;   ```

&#x20; </CodeSample>



&#x20; <CodeSample value="python\_python3" lang="python">

&#x20;   ```python

&#x20;   import http.client

&#x20;   

&#x20;   conn = http.client.HTTPSConnection("einvoice-api.sepay.vn")

&#x20;   

&#x20;   headers = { 'Authorization': "Bearer REPLACE\_BEARER\_TOKEN" }

&#x20;   

&#x20;   conn.request("GET", "/v1/invoices/084e179d-d95a-11f0-aef4-52c7e9b4f41b/download?type=pdf", headers=headers)

&#x20;   

&#x20;   res = conn.getresponse()

&#x20;   data = res.read()

&#x20;   

&#x20;   print(data.decode("utf-8"))

&#x20;   ```

&#x20; </CodeSample>



&#x20; <CodeSample value="node\_native" lang="javascript">

&#x20;   ```javascript

&#x20;   const http = require("https");

&#x20;   

&#x20;   const options = {

&#x20;     "method": "GET",

&#x20;     "hostname": "einvoice-api.sepay.vn",

&#x20;     "port": null,

&#x20;     "path": "/v1/invoices/084e179d-d95a-11f0-aef4-52c7e9b4f41b/download?type=pdf",

&#x20;     "headers": {

&#x20;       "Authorization": "Bearer REPLACE\_BEARER\_TOKEN"

&#x20;     }

&#x20;   };

&#x20;   

&#x20;   const req = http.request(options, function (res) {

&#x20;     const chunks = \[];

&#x20;   

&#x20;     res.on("data", function (chunk) {

&#x20;       chunks.push(chunk);

&#x20;     });

&#x20;   

&#x20;     res.on("end", function () {

&#x20;       const body = Buffer.concat(chunks);

&#x20;       console.log(body.toString());

&#x20;     });

&#x20;   });

&#x20;   

&#x20;   req.end();

&#x20;   ```

&#x20; </CodeSample>



&#x20; <CodeSample value="java\_okhttp" lang="java">

&#x20;   ```java

&#x20;   OkHttpClient client = new OkHttpClient();

&#x20;   

&#x20;   Request request = new Request.Builder()

&#x20;     .url("https://einvoice-api.sepay.vn/v1/invoices/084e179d-d95a-11f0-aef4-52c7e9b4f41b/download?type=pdf")

&#x20;     .get()

&#x20;     .addHeader("Authorization", "Bearer REPLACE\_BEARER\_TOKEN")

&#x20;     .build();

&#x20;   

&#x20;   Response response = client.newCall(request).execute();

&#x20;   ```

&#x20; </CodeSample>



&#x20; <CodeSample value="ruby\_native" lang="ruby">

&#x20;   ```ruby

&#x20;   require 'uri'

&#x20;   require 'net/http'

&#x20;   require 'openssl'

&#x20;   

&#x20;   url = URI("https://einvoice-api.sepay.vn/v1/invoices/084e179d-d95a-11f0-aef4-52c7e9b4f41b/download?type=pdf")

&#x20;   

&#x20;   http = Net::HTTP.new(url.host, url.port)

&#x20;   http.use\_ssl = true

&#x20;   http.verify\_mode = OpenSSL::SSL::VERIFY\_NONE

&#x20;   

&#x20;   request = Net::HTTP::Get.new(url)

&#x20;   request\["Authorization"] = 'Bearer REPLACE\_BEARER\_TOKEN'

&#x20;   

&#x20;   response = http.request(request)

&#x20;   puts response.read\_body

&#x20;   ```

&#x20; </CodeSample>



&#x20; <CodeSample value="go\_native" lang="go">

&#x20;   ```go

&#x20;   package main

&#x20;   

&#x20;   import (

&#x20;   	"fmt"

&#x20;   	"net/http"

&#x20;   	"io/ioutil"

&#x20;   )

&#x20;   

&#x20;   func main() {

&#x20;   

&#x20;   	url := "https://einvoice-api.sepay.vn/v1/invoices/084e179d-d95a-11f0-aef4-52c7e9b4f41b/download?type=pdf"

&#x20;   

&#x20;   	req, \_ := http.NewRequest("GET", url, nil)

&#x20;   

&#x20;   	req.Header.Add("Authorization", "Bearer REPLACE\_BEARER\_TOKEN")

&#x20;   

&#x20;   	res, \_ := http.DefaultClient.Do(req)

&#x20;   

&#x20;   	defer res.Body.Close()

&#x20;   	body, \_ := ioutil.ReadAll(res.Body)

&#x20;   

&#x20;   	fmt.Println(res)

&#x20;   	fmt.Println(string(body))

&#x20;   

&#x20;   }

&#x20;   ```

&#x20; </CodeSample>



&#x20; <CodeSample value="csharp\_httpclient" lang="csharp">

&#x20;   ```csharp

&#x20;   var client = new HttpClient();

&#x20;   var request = new HttpRequestMessage

&#x20;   {

&#x20;       Method = HttpMethod.Get,

&#x20;       RequestUri = new Uri("https://einvoice-api.sepay.vn/v1/invoices/084e179d-d95a-11f0-aef4-52c7e9b4f41b/download?type=pdf"),

&#x20;       Headers =

&#x20;       {

&#x20;           { "Authorization", "Bearer REPLACE\_BEARER\_TOKEN" },

&#x20;       },

&#x20;   };

&#x20;   using (var response = await client.SendAsync(request))

&#x20;   {

&#x20;       response.EnsureSuccessStatusCode();

&#x20;       var body = await response.Content.ReadAsStringAsync();

&#x20;       Console.WriteLine(body);

&#x20;   }

&#x20;   ```

&#x20; </CodeSample>



&#x20; <CodeSample value="swift\_nsurlsession" lang="swift">

&#x20;   ```swift

&#x20;   import Foundation

&#x20;   

&#x20;   let headers = \["Authorization": "Bearer REPLACE\_BEARER\_TOKEN"]

&#x20;   

&#x20;   let request = NSMutableURLRequest(url: NSURL(string: "https://einvoice-api.sepay.vn/v1/invoices/084e179d-d95a-11f0-aef4-52c7e9b4f41b/download?type=pdf")! as URL,

&#x20;                                           cachePolicy: .useProtocolCachePolicy,

&#x20;                                       timeoutInterval: 10.0)

&#x20;   request.httpMethod = "GET"

&#x20;   request.allHTTPHeaderFields = headers

&#x20;   

&#x20;   let session = URLSession.shared

&#x20;   let dataTask = session.dataTask(with: request as URLRequest, completionHandler: { (data, response, error) -> Void in

&#x20;     if (error != nil) {

&#x20;       print(error)

&#x20;     } else {

&#x20;       let httpResponse = response as? HTTPURLResponse

&#x20;       print(httpResponse)

&#x20;     }

&#x20;   })

&#x20;   

&#x20;   dataTask.resume()

&#x20;   ```

&#x20; </CodeSample>



&#x20; <CodeSample value="kotlin\_okhttp" lang="kotlin">

&#x20;   ```kotlin

&#x20;   val client = OkHttpClient()

&#x20;   

&#x20;   val request = Request.Builder()

&#x20;     .url("https://einvoice-api.sepay.vn/v1/invoices/084e179d-d95a-11f0-aef4-52c7e9b4f41b/download?type=pdf")

&#x20;     .get()

&#x20;     .addHeader("Authorization", "Bearer REPLACE\_BEARER\_TOKEN")

&#x20;     .build()

&#x20;   

&#x20;   val response = client.newCall(request).execute()

&#x20;   ```

&#x20; </CodeSample>



</CodeSamples>

