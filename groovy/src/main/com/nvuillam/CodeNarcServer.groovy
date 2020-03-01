package com.nvuillam

import org.codenarc.CodeNarc

/*
 * CodeNarc main class Wrapper to run a light HttpServer so next calls can have better performances

 * @author Nicolas Vuillamy
 */
class CodeNarcServer {

    /**
     * Main command-line entry-point. Run the CodeNarcServer application.
     * @param args - the String[] of command-line arguments
     */
    static void main(String[] args) {

        CodeNarcServer server = new CodeNarcServer()
        server.runCodeNarc(args);
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
}