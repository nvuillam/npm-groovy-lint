package com.nvuillam

import com.sun.net.httpserver.Filter
import com.sun.net.httpserver.HttpExchange
import groovy.transform.CompileStatic
import org.slf4j.Logger

/**
 * Provides request logging in Apache Common Log Format.
 */
@CompileStatic
final class LoggingFilter extends Filter {

    private final Logger logger

    LoggingFilter(Logger logger) {
        this.logger = logger
    }

    @Override
    void doFilter(HttpExchange http, Chain chain) throws IOException {
        LogOutputStream output = new LogOutputStream(http.responseBody)
        try {
            http.setStreams(http.requestBody, output)
            chain.doFilter(http)
        } finally {
            // Apache Common Log Format
            // %h %l %u [%t] "%r" %>s %b
            String date = new Date().format('dd/MMM/yyyy:HH:mm:ss Z')
            logger.info('{} {} {} [{}] "{} {} {}" {} {}',
                http.remoteAddress.address.hostAddress,
                '-',
                '-',
                date,
                http.requestMethod,
                http.requestURI.path,
                http.protocol,
                http.responseCode,
                output.written,
            )
        }
    }

    @Override
    String description() {
        return 'logging'
    }

}
