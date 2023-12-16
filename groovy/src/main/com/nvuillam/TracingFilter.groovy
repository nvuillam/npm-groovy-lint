package com.nvuillam

import com.sun.net.httpserver.Filter
import com.sun.net.httpserver.HttpExchange
import groovy.transform.CompileStatic
import java.util.function.Supplier

/**
 * Provides request tracking via X-Request-Id header.
 */
@CompileStatic
final class TracingFilter extends Filter {

    private static final String REQUEST_ID_KEY = 'requestId'
    private static final String REQUEST_HEADER = 'X-Request-Id'
    private final Supplier<String> nextRequestId

    TracingFilter(Supplier<String> nextRequestId) {
        this.nextRequestId = nextRequestId
    }

    @Override
    void doFilter(HttpExchange http, Chain chain) throws IOException {
        String requestId = http.requestHeaders.getFirst(REQUEST_HEADER) ?: nextRequestId.get()
        http.setAttribute(REQUEST_ID_KEY, requestId)
        http.responseHeaders.add(REQUEST_HEADER, requestId)
        chain.doFilter(http)
    }

    @Override
    String description() {
        return 'tracing'
    }

}
