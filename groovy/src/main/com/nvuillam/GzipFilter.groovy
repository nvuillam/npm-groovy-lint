package com.nvuillam

import com.sun.net.httpserver.Filter
import com.sun.net.httpserver.HttpExchange
import groovy.transform.CompileStatic

/**
 * Provides negotiated Gzip streaming compression.
 */
@CompileStatic
final class GzipFilter extends Filter {

    @Override
    void doFilter(HttpExchange exchange, Chain chain) throws IOException {
        final String acceptEncoding = exchange.getRequestHeaders().getFirst('Accept-Encoding')
        final List<String> acceptEncodings = acceptEncoding.tokenize(',')*.trim()
        chain.doFilter(acceptEncodings.contains('gzip') ? new GzipHttpExchange(exchange) : exchange)
    }

    @Override
    String description() {
        return 'gzip'
    }

}
