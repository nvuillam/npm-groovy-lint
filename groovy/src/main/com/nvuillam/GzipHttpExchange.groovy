package com.nvuillam

import com.sun.net.httpserver.Headers
import com.sun.net.httpserver.HttpContext
import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpPrincipal
import groovy.transform.CompileStatic
import java.util.zip.GZIPOutputStream

/**
 * Provides gzip response body compression.
 */
@CompileStatic
class GzipHttpExchange extends HttpExchange implements Closeable {

    private final HttpExchange inner
    private GZIPOutputStream wrappedResponseBody = null

    GzipHttpExchange(HttpExchange inner) {
        this.inner = inner
    }

    @Override
    OutputStream getResponseBody() {
        return wrappedResponseBody ?: inner.getResponseBody()
    }

    @Override
    void sendResponseHeaders(int rCode, long responseLength) throws IOException {
        responseHeaders.add('Vary', 'Accept-Encoding')
        responseHeaders.add('Content-Encoding', 'gzip')
        inner.sendResponseHeaders(rCode, 0)
        wrappedResponseBody = new GZIPOutputStream(inner.getResponseBody())
    }

    // All methods below just forwarded to inner.
    @Override
    Headers getRequestHeaders() {
        return inner.getRequestHeaders()
    }

    @Override
    Headers getResponseHeaders() {
        return inner.getResponseHeaders()
    }

    @Override
    URI getRequestURI() {
        return inner.getRequestURI()
    }

    @Override
    String getRequestMethod() {
        return inner.getRequestMethod()
    }

    @Override
    HttpContext getHttpContext() {
        return inner.getHttpContext()
    }

    @Override
    void close() {
        inner.close()
    }

    @Override
    InputStream getRequestBody() {
        return inner.getRequestBody()
    }

    @Override
    InetSocketAddress getRemoteAddress() {
        return inner.getRemoteAddress()
    }

    @Override
    int getResponseCode() {
        return inner.getResponseCode()
    }

    @Override
    InetSocketAddress getLocalAddress() {
        return inner.getLocalAddress()
    }

    @Override
    String getProtocol() {
        return inner.getProtocol()
    }

    @Override
    Object getAttribute(String name) {
        return inner.getAttribute(name)
    }

    @Override
    void setAttribute(String name, Object value) {
        inner.setAttribute(name, value)
    }

    @Override
    void setStreams(InputStream i, OutputStream o) {
        inner.setStreams(i, o)
    }

    @Override
    HttpPrincipal getPrincipal() {
        return inner.getPrincipal()
    }

}
