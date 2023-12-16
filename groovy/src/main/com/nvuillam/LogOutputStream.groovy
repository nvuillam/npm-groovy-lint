package com.nvuillam

import groovy.transform.CompileStatic

/**
 * Records the number of bytes written to an OutputStream.
 *
 * This can be used to record the size of the response sent as
 * needed by LoggingFilter.
 */
@CompileStatic
class LogOutputStream extends OutputStream implements Closeable {

    private long written = 0
    private final OutputStream inner

    LogOutputStream(OutputStream inner) {
        this.inner = inner
    }

    @Override
    void close() {
        inner.close()
    }

    @Override
    void flush() {
        inner.flush()
    }

    @Override
    void write(byte[] b) {
        write(b, 0, b.length)
        written += b.length
    }

    @Override
    void write(byte[] b, int off, int len) {
        inner.write(b, off, len)
        written += len
    }

    @Override
    void write(int b) {
        inner.write(b)
        written++
    }

    long getWritten() {
        return written
    }

}
