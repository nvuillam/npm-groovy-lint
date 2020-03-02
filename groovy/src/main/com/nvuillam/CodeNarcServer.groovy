package com.nvuillam

import com.sun.net.httpserver.HttpServer
import com.sun.net.httpserver.HttpExchange

import org.codenarc.CodeNarc

/*
 * CodeNarc main class Wrapper to run a light HttpServer so next calls can have better performances

 * @author Nicolas Vuillamy
 */
class CodeNarcServer {

    int PORT = 7484 

    /**
     * Main command-line entry-point. Run the CodeNarcServer application.
     * @param args - the String[] of command-line arguments
     */
    static void main(String[] args) {
        println 'CodeNarcServer: '+args
        final List<String> argsList =  new ArrayList<String>()
        Collections.addAll(argsList, args); 
        CodeNarcServer server = new CodeNarcServer()
        if (argsList.contains('--server')) {
            server.initialize()
            argsList.remove('--server')
            argsList.remove('--port')
        }
        if (['-basedir','-includes','-excludes','-rulesetfiles','-report','-help'].intersect(argsList)) {
            server.runCodeNarc((String[])argsList)
        }
    }

    void initialize() {
        HttpServer.create(new InetSocketAddress(PORT), /*max backlog*/ 0).with {
            println "Server is listening on ${PORT}, hit Ctrl+C to exit."    
            createContext("/") { http ->
                println "INIT: Hit from Host: ${http.remoteAddress.hostName} on port: ${http.remoteAddress.holder.port}"
                try {
                    def queryParams = getQueryParameters(http)
                    println queryParams
                    def codenarcArgs = queryParams.codenarcargs 
                    def codenarcArgsArray = codenarcArgs.split(" ")
                    runCodeNarc(codenarcArgsArray)
                    http.responseHeaders.add("Content-type", "text/plain")
                    http.sendResponseHeaders(200, 0)
                    http.responseBody.withWriter { out ->
                        out << "Hello ${http.remoteAddress.hostName}!\n"
                }
                println "Hit from Host: ${http.remoteAddress.hostName} on port: ${http.remoteAddress.holder.port}"
                } catch (Throwable t) {
                    t.printStackTrace()
                }
            }
            start()
        }
    }

    protected runCodeNarc(String[] args) {
        CodeNarc codeNarc = new CodeNarc()
        try {
            codeNarc.execute(args)
        }
        catch(Throwable t) {
            println "CodeNarcServer ERROR: ${t.toString()}"
            t.printStackTrace()
        }
    }

    private Map<String,String> getQueryParameters( HttpExchange httpExchange ) {
        def query = httpExchange.getRequestURI().getQuery()
        return query.split( '&' )
                .collectEntries {
            String[] pair = it.split( '=' )
            if (pair.length > 1)
            {
                return [(pair[0]): pair[1]]
            }
            else
            {
                return [(pair[0]): ""]
            }
        }
    }
}