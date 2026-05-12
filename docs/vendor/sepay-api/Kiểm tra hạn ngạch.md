\# Kiểm tra hạn ngạch



\## API trả về số lượt phát hành/xuất hóa đơn còn lại của gói dịch vụ hiện tại. Giá trị cập nhật theo thời gian thực.



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



&#x20; <Path>https://einvoice-api.sepay.vn/v1/usage</Path>



&#x20; <Description>

&#x20;   Kiểm tra hạn ngạch

&#x20; </Description>



&#x20; <Authentication>

&#x20;   bearerAuth

&#x20; </Authentication>

</Endpoint>



\#### API Request



Endpoint này không yêu cầu tham số request. Chỉ cần gửi Bearer token trong header để xác thực.



\#### API Response



<Responses>

&#x20; <Response status="200">

&#x20;   <Description>

&#x20;     Thông tin hạn ngạch

&#x20;   </Description>



&#x20;   <Example>

&#x20;     {

&#x20;       "data": {

&#x20;         "quota\_remaining": "534"

&#x20;       }

&#x20;     }

&#x20;   </Example>

&#x20; </Response>



</Responses>



<ResponseDescriptionFields>

&#x20; <ResponseSchema status="200">

&#x20;   <Fields>

&#x20;     <Field name="data" type="object" required="false">

&#x20;       <Fields>

&#x20;         <Field name="quota\_remaining" type="string" required="true">

&#x20;           Số lượt thao tác hóa đơn còn lại

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

&#x20; { code: 401, name: "Unauthorized", description: "Thiếu hoặc token không hợp lệ/đã hết hạn." }

]}

/>



\#### Lưu ý



<Callout type="info" title="Về giá trị quota\_remaining">

quota\_remaining

&#x20;là số lượt phát hành hóa đơn còn lại trong gói dịch vụ hiện tại

Giá trị được cập nhật theo thời gian thực sau mỗi lần phát hành hóa đơn thành công

</Callout>



<Callout type="success" title="Hóa đơn nháp không tính vào hạn ngạch">

Khi xuất hóa đơn với 

`is\_draft: true`

, hệ thống sẽ không trừ hạn ngạch. Hạn ngạch chỉ bị trừ khi hóa đơn được 

phát hành chính thức

&#x20;(gọi API phát hành hoặc xuất với 

`is\_draft: false`

).

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

&#x20;     --url https://einvoice-api.sepay.vn/v1/usage \\

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

&#x20;     CURLOPT\_URL => "https://einvoice-api.sepay.vn/v1/usage",

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

&#x20;   conn.request("GET", "/v1/usage", headers=headers)

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

&#x20;     "path": "/v1/usage",

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

&#x20;     .url("https://einvoice-api.sepay.vn/v1/usage")

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

&#x20;   url = URI("https://einvoice-api.sepay.vn/v1/usage")

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

&#x20;   	url := "https://einvoice-api.sepay.vn/v1/usage"

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

&#x20;       RequestUri = new Uri("https://einvoice-api.sepay.vn/v1/usage"),

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

&#x20;   let request = NSMutableURLRequest(url: NSURL(string: "https://einvoice-api.sepay.vn/v1/usage")! as URL,

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

&#x20;     .url("https://einvoice-api.sepay.vn/v1/usage")

&#x20;     .get()

&#x20;     .addHeader("Authorization", "Bearer REPLACE\_BEARER\_TOKEN")

&#x20;     .build()

&#x20;   

&#x20;   val response = client.newCall(request).execute()

&#x20;   ```

&#x20; </CodeSample>



</CodeSamples>



\#### Bước tiếp theo



Sau khi kiểm tra hạn ngạch:



\* Nếu còn hạn ngạch, bạn có thể \*\*\[Xuất hóa đơn điện tử](/vi/einvoice-api/xuat-hoa-don-dien-tu)\*\* để tạo hóa đơn mới

\* Nếu hết hạn ngạch, vui lòng liên hệ SePay để nâng cấp gói dịch vụ

