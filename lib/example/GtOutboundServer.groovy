//N.VUILLAMY: This script is standard, if you update it, it's at your own risk and you'll be responsible of its maintenance
//V0.91 N.VUILLAMY Beta version for GT 3.80 & GT 3.90
//V2.00 N.VUILLAMY Add HTTP calls management (can be used for REST calls) . Version minimum:  GT 3.90. 
//                                                              SOAP calls now go thru RESTClient library, to have only one method to maintain.
//V2.01 N.VUILLAMY Add ignore SSL Issues option (use it only for tests / demo, else it's not safe)  + Add SOAP Action Http Header for SOAP calls
//v2.1  N.VUILLAMY Add Proxy management
//v2.2  N.VUILLAMY Manage SOAPAction header (requires last GT3.90 patch)
//v2.3  N.VUILLAMY Allow to send queryParam as string , not only as Map . Ex: ["fullQueryStringFromGt" = "?a=1&b=2" ] in oWS handle_request method

//Import libraries
// Requires the following libraries in CLASSPATH (folder is just a suggestion):
// #$APP_HOME#/java/lib/graphtalk-language.jar;\
// #$APP_HOME#/java/lib/antlr-runtime-3.1.3.jar;\
// #$GTMONITOR_HOME#/lib/gtgroovy.jar;\
// #$GTMONITOR_HOME#/lib/json-lib-2.4-jdk15.jar;\
// #$GTMONITOR_HOME#/lib/xml-commons-resolver-1.1.jar;\
// #$GTMONITOR_HOME#/lib/commons-collections-3.2.1.jar;\
// #$GTMONITOR_HOME#/lib/commons-io-2.4.jar;\
// #$GROOVY_HOME#/lib/groovy-json-2.2.2.jar;\
// #$GROOVY_HOME#/lib/groovy-xml-2.2.2.jar;\
// #$GTMONITOR_HOME#/lib/httpclient-4.4.1.jar;\
// #$GTMONITOR_HOME#/lib/httpcore-4.4.1.jar;\
// #$GTMONITOR_HOME#/lib/http-builder-0.7.1.jar;\

// Parameters can be defined in handle_request GT method or in INI -> [GTMonitor]ServiceParameters(myconnexion)
// They are described in  in OutboundWSCaller constructor 

// Common
import org.apache.commons.logging.LogFactory;
import org.codehaus.groovy.runtime.*;
import com.csc.gtmonitor.*;
import com.csc.graphtalk.*;
import com.csc.graphtalk.language.GtString ;
import com.csc.graphtalk.language.GtPropertyList ;
import java.util.Map;
import static groovyx.net.http.Method.* ;
import static groovyx.net.http.ContentType.* ; 
import org.apache.commons.io.IOUtils ;
import groovy.lang.Binding ;

// For HTTP/REST
import groovyx.net.http.RESTClient; 
import groovy.json.JsonSlurper;

GtMonitorBytesMessage gtMsg = new GtMonitorBytesMessage();
gtMsg = gtRequest ; 

// Extract GTPlist from GTMonitorRequest
GtPropertyList requestMsgPlist = GtPropertyList.parse(gtMsg.toString());

// Call OutboundWSCaller
OutboundWSCaller oWSCaller = new OutboundWSCaller(requestMsgPlist) ;
GtPropertyList responseMsgPlist = oWSCaller.invoke(); 

// Set response in GtMonitorBytesMessage object
GtMonitorBytesMessage responseMsg = gtMsg.cloneMessage();
responseMsg.clear();
responseMsg.setMsgBytes(responseMsgPlist.toGraphTalkString().getBytes("UTF-8"));

// return result
return responseMsg; 

///////////////////////////// Class & methods ( WARNING: to customize with caution !!!!! Clone & rename methods if possible) /////////////////////////////////////////
def public class OutboundWSCaller {

                // WS Config properties (sent from GT , or use default values)
                private String wsCallMode = 'sync';
                private String wsProtocol = 'soap'; //  soap by default , can also be http (used for REST)
                private int traceLevel = 3;
                private int timeOutDelay = 30 ; 
                private String httpProxyHost = null ;
                private int httpProxyPort = -1 ;
                private boolean responseTypeCheck = true ;
                private boolean ignoreSSLIssues = false ; 

                // Http request properties (mandatory sent from GT)
                private String httpUrl = "" ;
                private httpBody ; // no type, can be String (XML), Map or List (JSON)

                // Just for HTTP (can be used for REST)
                private Map<String,Object> httpHeaders = [:] ;
                private String httpVerb="GET";
                private String httpPath="/";
                private String httpRequestType = "";
                private String httpResponseType = "";
                private Map<String,Object> httpQueryParams = [:] ;
                
                private def convertDataIn = [:] ;
                
                private def convertDataOut = [:] ;

                // SOAP properties
                private String soapAction="";

                // Http response properties (will be sent back to GT)
                private int responseCode ;
                private Map responseHeaders ;
                private responseBody = ''; // No type: result can be String(XML), Map or List (Json), and GtPropertyList constructor will convert it as string or Plist

                // GT response properties (will be sent back to GT)
                private String callStatus ; // = 'ok' if there has been a response (even 500 or soapFault) , 'ko' if not
                private String errorDtl ; // contains exception to send back to GT

                //Log props
                private def log = LogFactory.getLog('com.csc.graphtalk.outbound'); 

                // Constructor, to call with GTMonitorRequest object
                public OutboundWSCaller(GtPropertyList requestMsgPlist)
                {

                               // override default parameters with values from request if needed
                               initWSCallParam('ws_protocol',requestMsgPlist,'wsProtocol');                                                                                 // soap or http

                               switch (this.wsProtocol)
                               {
                                               case 'soap': this.log = LogFactory.getLog('com.csc.graphtalk.outbound.soap') ;
                                                                                              initWSCallParam('soap_body',requestMsgPlist,'httpBody');                                       // Body as string
                                                                                              initWSCallParam('soap_action',requestMsgPlist,'soapAction');                                 // SOAPACtion as string
                                                                                              break ;

                                               case 'http': this.log = LogFactory.getLog('com.csc.graphtalk.outbound.http') ;
                                                                                              initWSCallParam('data',requestMsgPlist,'httpBody');                                                    // Body as string (or Plist if JSON ) 
                                                                                               initWSCallParam('httpMethod',requestMsgPlist,'httpVerb');                                     // GET,POST,HEAD,OPTIONS,DELETE,PUT
                                                                                              initWSCallParam('uri',requestMsgPlist,'httpPath');                                                         // Path: ex: /posts/8
                                                                                              initWSCallParam('queryParams',requestMsgPlist,'httpQueryParams');  // QueryParams: ex: ["a"=1,"b"=2], or ["fullQueryStringFromGt" = "?a=1&b=2"]
                                                                                              initWSCallParam('httpHeaders',requestMsgPlist,'httpHeaders');                              // HTTP Headers
                                                                                              initWSCallParam('convert_data_in',requestMsgPlist,'convertDataIn');                   // Map for http body conversion before call ( works only for Http/JSon input ). Ex: ["someData" = "xml2base64" ]
                                                                                              initWSCallParam('convert_data_out',requestMsgPlist,'convertDataOut');                            // Map for http response conversion after call ( works only for Http/JSon input ) Ex: ["someData" = "xml2base64" ]
                                                                                              break ;            
                               }

                               initWSCallParam('trace_level',requestMsgPlist,'traceLevel');                                                                                     // Trace Level, from 0(higher) to 5(lower)
                               initWSCallParam('ws_call_mode',requestMsgPlist,'wsCallMode');                                                                                           // Call mode: sync,async
                               initWSCallParam('timeout_delay',requestMsgPlist,'timeOutDelay');                                                                       // Timeout delay in seconds
                               initWSCallParam('url',requestMsgPlist,'httpUrl');                                                                                                                                           // Host:port. Ex: http://www.somesite.com:80
                               initWSCallParam('requestType',requestMsgPlist,'httpRequestType');                                                                    // requestType: XML,JSON, or specific content type , like application/soap+xml
                               initWSCallParam('proxy_host',requestMsgPlist,'httpProxyHost');                                                                             // responseType: XML,JSON, or specific content type , like application/soap+xml
                               initWSCallParam('proxy_port',requestMsgPlist,'httpProxyPort');                                                                              // responseType: XML,JSON, or specific content type , like application/soap+xml
                               initWSCallParam('responseType',requestMsgPlist,'httpResponseType');                                                               // responseType: XML,JSON, or specific content type , like application/soap+xml
                               initWSCallParam('responseTypeCheck',requestMsgPlist,'responseTypeCheck');                                // defines if received response content type is corresponding to sent Accept header
                               initWSCallParam('ignore_ssl_issues',requestMsgPlist,'ignoreSSLIssues');                                                                              // Allow to ignore SSL issues ( to use for TESTS / DEMO, not prod coz it's not safe ! )

                } 

                // Get config from GtMonitorRequest arguments or let class default values
                private void initWSCallParam(String configVarName,GtPropertyList Args,classPropName)
                {
                               def val = Args.get(configVarName) ;
                               if ( val != null)
                               {
                                               switch(configVarName){
                                                               // In case argument comes as GTPropertyList, we call getJavaValue to retrieve a single HashMap [prop = val] instead of [prop = [val_type =xxx, val_value = yyy...]]
                                                               case 'httpHeaders': 
                                                               case 'queryParams': 
                                                               case 'data':                           this.setProperty(classPropName,val.getJavaValue()); break ;
                                                               default :  this.setProperty(classPropName,val.getValue());
                                               }
                               }
                               if (this.log.isDebugEnabled()) 
                                               this.trace(classPropName+' parameter:'+this.getProperty(classPropName),4);
                }

                // Invoke request with behaviour corresponding to wsProtocol 
                public GtPropertyList invoke()
                {
                               switch (this.wsProtocol)
                               {
                                               case 'soap' : //this.callRemoteServerHttpURLConnection(); //NV: Uncomment to use old method with HttpURLConnection
                                                                                                this.callRemoteServerRESTClientForSOAP();
                                                                                                break ;
                                               case 'http' : this.callRemoteServerRESTClient();
                                                                                                break ;
                                               default : throw new Exception (this.wsProtocol+' protocol not managed by this groovy script') ;
                               }

                               return this.getWSResult();
                }

                // Build GTPropertyList result for GT caller  (GT is awaiting for different formats for SOAP or HTTP )
                public GtPropertyList getWSResult()
                {
                               def Map resultLs = [:] ;
                               if (this.wsProtocol == 'http' )
                                               resultLs = [data: this.responseBody, call_status: this.callStatus , httpStatus: this.responseCode, httpHeaders: this.responseHeaders ,call_status_dtl:[error: this.errorDtl]] ;
                               else        
                                               resultLs = [response: this.responseBody, call_status: this.callStatus , call_status_dtl: [response_code: this.responseCode, error: this.errorDtl,  response_headers: this.responseHeaders ]] ;
                               return new GtPropertyList(resultLs);
                }

                // Use Groovy HttpBuilder RESTClient to perform SOAP calls
                private void callRemoteServerRESTClientForSOAP()
                {
                               // Convert URL into requested parameters for RESTClient 
                               def URL url = new URL(this.httpUrl) ;
                               if (url.getPort() == -1)
                                               url.port= 80 ;
                               this.httpUrl = url.getProtocol()+'://'+url.getHost()+':'+url.getPort() ;
                               this.httpPath = url.getPath();
                               
                               this.httpVerb = 'POST' ; // SOAP calls always use POST HTTP verb
                               
                               // Force SOAP content types if not sent as parameters
                               if (!this.httpRequestType)
                                               this.httpHeaders['Content-Type'] = 'application/soap+xml; charset=utf-8';
                
                               if (!this.httpResponseType)
                               {              
                                               this.httpHeaders['Accept'] = 'application/soap+xml';
                                               this.httpHeaders['Accept-Charset'] = 'utf-8';
                               }
                               
                               this.httpHeaders['SOAPAction'] = this.soapAction ;
                                                               
                               this.responseTypeCheck = false ; // to avoid errors coz servers return text/xml instead of application/xml
                               this.callRemoteServerRESTClient();
                }
                
                // Use Groovy HttpBuilder RESTClient to perform HTTP calls
                private void callRemoteServerRESTClient()
                {

                               // Path
                               def httpParameters = [path: this.httpPath] ;

                               // QueryParams as string
                               if (this.httpQueryParams != [:] && this.httpQueryParams.get('fullQueryStringFromGt')) {
                                   httpParameters['queryString'] = this.httpQueryParams.get('fullQueryStringFromGt') ;
                               }
                               // QueryParams as map
                               else if ( this.httpQueryParams != [:] )
                               {
                                   httpParameters['query'] = this.httpQueryParams ;
                               }

                               //Headers
                               if (this.httpHeaders != [:]) 
                                               httpParameters['headers'] = this.httpHeaders ;
                               else
                                               httpParameters['headers'] = [:] ;

                               // Content-Type header: if not in httpHeaders, use requestType to build it
                               if (httpParameters['headers'].get('Content-Type') == null)
                                               httpParameters['headers']['Content-Type'] = this.convertContentType(this.httpRequestType);
                               
                               // Accept header: if not in httpHeaders, use responseType to build it
                               if (httpParameters['headers'].get('Accept') == null)
                                               httpParameters['headers']['Accept'] = this.convertContentType(this.httpResponseType);
                               
                               // Format & Add body in parameters when the verb allows it
                               if (this.httpVerb in ['POST','PUT','PATCH'] && this.httpBody != null)
                               {
                                               
                                               if (isJson(httpParameters['headers']['Content-Type']))
                                               {
                                                               this.convertInputData();
                                                               def jBuilder = new groovy.json.JsonBuilder(this.httpBody);
                                                               httpParameters['body'] = jBuilder.toString(); // JSON body
                                               }
                                               else
                                                               httpParameters['body'] = this.httpBody ; // XML or other format body
                               }

                               if (this.log.isInfoEnabled())
                                               this.trace('Attempt:'+this.httpUrl+' ; '+this.httpVerb+' ; '+httpParameters.toString(),3);

                               try {
                                               // Let's try to create client 
                                               def client = new RESTClient(this.httpUrl);
                                               if (this.httpProxyHost != null)
                                                               client.setProxy(this.httpProxyHost,this.httpProxyPort,null);

                                               if (this.ignoreSSLIssues == true)
                                                               client.ignoreSSLIssues(); // NICO: ugly & not safe , don't use that in prod !!!!!
                                               client.handler.failure = client.handler.success ; // We want to retrieve response even if error is 500
                                               
                                               client.setContentType(httpParameters['headers']['Content-Type']) ;
                                               client.getClient().getParams().setParameter("http.connection.timeout", new Integer(this.timeOutDelay * 1000)) ;
                                               client.getClient().getParams().setParameter("http.socket.timeout", new Integer(this.timeOutDelay * 1000))  ;

                                               // We don't want RestClient to encode/parse, we'll do it ourselves if necessary. Add missing cases if necessary (plz notify GT AIA WS Team)
                                               client.encoder.'application/soap+xml' = client.encoder.'text/plain' ;
                                               client.encoder.'application/vnd.hal+json' = client.encoder.'text/plain' ;
                                               client.parser.'application/xml' = client.parser.'text/plain' ; 
                                               client.parser.'application/json' = client.parser.'text/plain' ;
                                               client.parser.'application/vnd.hal+json' = client.parser.'text/plain' ;
                                               client.parser.'text/html' = client.parser.'text/plain' ;
                                               client.parser.'text/xml' = client.parser.'text/plain' ;
                                               client.parser.'application/soap+xml' = client.parser.'text/plain' ;

                                               def Accept = httpParameters['headers']['Accept'] ;
                                               
                                               // New let's try to process REST action
                                               switch (this.httpVerb)
                                               {
                                                               case 'GET':          def resp = client.get(httpParameters);
                                                                                                                              setHTTPresponse(resp,Accept);
                                                                                                                              break ;

                                                               case 'POST':    def resp = client.post(httpParameters);
                                                                                                                              setHTTPresponse(resp,Accept);
                                                                                                                              break ;

                                                               case 'HEAD':    def resp = client.head(httpParameters);
                                                                                                                              setHTTPresponse(resp,Accept);
                                                                                                                              break ;

                                                               case 'OPTIONS': def resp = client.options(httpParameters);
                                                                                                                              setHTTPresponse(resp,Accept);
                                                                                                                              break ;  

                                                               case 'DELETE':  def resp = client.delete(httpParameters);
                                                                                                                              setHTTPresponse(resp,Accept);
                                                                                                                              break ;

                                                               case 'PUT':     def resp = client.put(httpParameters);
                                                                                                                              setHTTPresponse(resp,Accept);
                                                                                                                              break ;

                                                               default :       throw new Exception (this.httpVerb+' verb not managed by this groovy script');
                                               }
                                               
                               } 
                               catch(Exception e1) {
                                               // Any twrowed exception
                                               this.callStatus = 'ko' ;
                                               this.errorDtl = e1.toString()+'; Stack:'+e1.getStackTrace().toString();
                                               if (this.log.isErrorEnabled())
                                                               this.trace('HTTPClient Error:'+this.errorDtl,1);
                               }

                               if (this.log.isInfoEnabled()) 
                                               this.trace('Call Result:'+this.getWSResult().toGraphTalkString(),3);
                }

                private void setHTTPresponse(resp,Accept)
                {
                               // Get Status Code
                               this.responseCode = resp.getStatus() ;

                               // Get response headers
                               this.responseHeaders = [:] ;
                               resp.getHeaders().each {
                                               this.responseHeaders["${it.name}"] = "${it.value}" ;
                               }

                               // Parse response ("cased" comparison OK - "resp" object handles caseless-ness)
                               if (resp.data && resp.getContentType() && resp.data != "" )
                               {
                                               def respContentType = resp.getContentType();
                                               def responseRaw = IOUtils.toString(resp.data);
                
                                               // error if returned content type is wrong
                                               if (this.responseTypeCheck == true && !respContentType.toString().startsWith(Accept))
                                                               throw new Exception ('Requested content type is '+Accept+' but server responded '+respContentType+'. Raw: '+responseRaw);
                
                                                // Parse response if necessary
                                               if (isJson(respContentType))
                                               { // JSON
                                                               def jsonSlurper = new JsonSlurper(); 
                                                               this.responseBody = jsonSlurper.parseText(responseRaw);
                                                               this.convertOutputData();
                                               }
                                               else
                                               { // XML / Other
                                                               this.responseBody = responseRaw ;
                                               } 
                               }

                               // Tech params for GT
                               this.callStatus = 'ok' ;
                               this.errorDtl = null ;
                }

                private String convertContentType(String contentType)
                {
                               String HttpContentTypeValue = "" ;
                               switch(contentType){
                                               case "JSON" : HttpContentTypeValue = groovyx.net.http.ContentType.JSON ; break ;
                                               case "XML" : HttpContentTypeValue = groovyx.net.http.ContentType.XML ; break ;
                                               case "" : HttpContentTypeValue = groovyx.net.http.ContentType.JSON ; break ; // Default value is JSON
                                               default : HttpContentTypeValue = contentType ; break ; // we can force other content types like "application/vnd.hal+json" in [GTMonitor]ServiceParameters in .INI file or in handle_request GT method
                               }
                               return HttpContentTypeValue ; 
                }

                private boolean isJson(String contentType)
                {
                               if (contentType.startsWith( groovyx.net.http.ContentType.JSON.toString()))
                                               return true ;
                               else if (contentType.startsWith('application/vnd.hal+json'))
                                               return true ;
                               else return false 
                }
                
                private void convertInputData() {
                               this.trace('CONVERT INPUT DATA MAP: '+this.convertDataIn,3);
                               this.trace('HTTPBODY__BEFORE: '+this.httpBody,3);
                               //this.trace('Class HTTPBODY: '+this.convertDataIn.getClass(),3);
                               //this.trace('Valeur de a convertir : '  +this.convertDataIn["datastreamContentAsBase64"],3);
                               
                               if ( this.convertDataIn != null && !this.convertDataIn.keySet().isEmpty()){
                                               String convertToBase64 = "xml2base64";
                                               for(key in this.convertDataIn.keySet().sort()){
                                                               if(this.convertDataIn[key].toString().equalsIgnoreCase(convertToBase64)){ 
                                                                               println('key httpBody : ' + key);
                                                                               //println('value httpBody : ' + this.convertDataIn[key]);
                                                                               println('*******************************************************************');
                                                                               println('value httpBody : ' + this.httpBody["${key}"].getBytes("UTF-8"));

                                                                               // FIX XML FLOW
                                                                               // this.httpBody["${key}"]=this.httpBody["${key}"].toString().replaceAll("</OwnerPrsn>", "<OwnerPrsn/>");

                                                                               //def encoded = this.httpBody["${key}"].bytes.encodeBase64().toString();
                                                                               def encoded = this.httpBody["${key}"].getBytes("UTF-8").encodeBase64().toString();
                                                                               println('encoded : ' + encoded );
                                                                              this.httpBody["${key}"]=encoded;
                                                               }                                                             
                                               }
                               }
                }

                private void convertOutputData() {
                               this.trace('CONVERT OUTPUT DATA MAP: '+this.convertDataOut,3);
                               // update this.responseBody here
                               
                }
                
                // Unique entry point for tracing: use trace_level = 99 for println (debug in Groovy Console)
                private void trace(String str,int xLevel) 
                {
                               if (this.traceLevel == -1)
                                               println('oWS:'+str);
                               else
                               { 
                                               str = 'oWS:'+str ;
                                               if (this.traceLevel >= xLevel)
                                               {
                                                               switch(xLevel){
                                                                               case 5 : this.log.trace(str); break ;
                                                                               case 4 : this.log.debug(str); break ;
                                                                               case 3 : this.log.info(str); break ;
                                                                               case 2 : this.log.warn(str); break ;
                                                                               case 1 : this.log.error(str); break ;
                                                                               case 0 : this.log.fatal(str);
                                                               }

                                               }
                               }
                }
                
                // HttpURLConnection method processing the call to the remote server (deprecated but still can be used in case of problems with RESTClient library )
                private void callRemoteServerHttpURLConnection()
                {
                               def InputStream responseStream;
                               def HttpURLConnection connection ;
                               // Try to connect & get response. If problem, keep exception detail to be able to return it to GT
                               boolean connexionOk = false ;
                               if (this.log.isInfoEnabled())
                                               this.trace('Attempt:'+this.httpUrl+' ; '+this.httpBody,3);
                               try { // Let's try to connect to remote server

                                               // Create URL Connection & set its infos
                                               def URL url = new URL(this.httpUrl);
                                               connection = (HttpURLConnection)url.openConnection();
                                               connection.setConnectTimeout(this.timeOutDelay * 1000); // Convert parameter in seconds into miliseconds
                                               connection.setReadTimeout(this.timeOutDelay * 1000); // Convert parameter in seconds into miliseconds
                                               connection.setRequestMethod('POST');
                                               connection.setRequestProperty('Accept-Charset', 'utf-8');
                                               connection.setRequestProperty('Accept', 'text/xml');
                                               connection.setRequestProperty('Content-Type', 'text/xml; charset=UTF-8');

                                               // Call remote soap server
                                               connection.doOutput = true;
                                               def OutputStreamWriter writer = new OutputStreamWriter(connection.outputStream);
                                               writer.write(this.httpBody);
                                               writer.flush();
                                               writer.close();
                                               connection.connect();
                                               connexionOk = true ;
                               } catch(IOException e1) {
                                               // Connexion error (dns error for example)
                                               this.callStatus = 'ko' ;
                                               this.errorDtl = e1.toString();
                                               if (this.log.isErrorEnabled())
                                                               this.trace('Connexion Error:'+this.errorDtl+';'+connection.toString(),1);
                               }

                               if (connexionOk) // No connection error, let's continue with response management
                               {
                                               try {

                                                               // Get response & set it on local object
                                                               this.responseCode = connection.getResponseCode();
                                                               responseStream = connection.getInputStream();
                                                               this.responseHeaders =  connection.getHeaderFields();
                                                               this.responseBody = responseStream.getText('utf-8');
                                                               this.callStatus = 'ok' ;
                                                               this.errorDtl = null ;
                                               } catch(IOException e2) {
                                                               //
                                                               if(this.responseCode == 500)
                                                               {
                                                                               // Remove server responded something: set it on local object to be able to return it to GT
                                                                               responseStream = connection.getErrorStream();
                                                                               this.responseBody = responseStream.getText('utf-8');
                                                                               this.callStatus = 'ok' ;
                                                               }
                                                               else
                                                               {
                                                                               // Unexpected error , like bad XML flow with open tag & without close tag,  for example
                                                                               this.callStatus = 'ko' ;
                                                                               this.errorDtl = e2.toString();
                                                                               if (this.log.isErrorEnabled())
                                                                                              this.trace('Connexion Error:'+this.errorDtl+';'+connection.toString(),1);
                                                               }
                                               }
                                               if (responseStream)
                                                               responseStream.close();
                               }
                               if (this.log.isInfoEnabled())
                                               this.trace('Call Result:'+this.getWSResult().toGraphTalkString(),3);
                }
                
}
