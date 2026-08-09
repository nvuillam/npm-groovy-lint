package com.nvuillam

import com.sun.net.httpserver.Filter
import com.sun.net.httpserver.HttpExchange
import groovy.time.TimeCategory
import groovy.time.TimeDuration
import groovy.transform.CompileStatic
import java.time.Duration
import java.time.format.DateTimeFormatter
import java.time.ZonedDateTime
import java.time.ZoneOffset
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
        ZonedDateTime start = ZonedDateTime.now(ZoneOffset.UTC)
        LogOutputStream output = new LogOutputStream(http.responseBody)
        try {
            http.setStreams(http.requestBody, output)
            chain.doFilter(http)
        } finally {
            // Apache Common Log Format + processing time in milliseconds
            // %h %l %u [%t] "%r" %>s %b
            ZonedDateTime stop = ZonedDateTime.now(ZoneOffset.UTC)
            String date = stop.format(DateTimeFormatter.ofPattern('dd/MMM/yyyy:HH:mm:ss Z'))
            Duration duration = Duration.between(start, stop);
            logger.info('{} {} {} [{}] "{} {} {}" {} {} {}ms',
                http.remoteAddress.address.hostAddress,
                '-',
                '-',
                date,
                http.requestMethod,
                http.requestURI.path,
                http.protocol,
                http.responseCode,
                output.written,
                duration.toMillis(),
            )
        }
    }

    @Override
    String description() {
        return 'logging'
    }

}
