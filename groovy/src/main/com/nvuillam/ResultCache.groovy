package com.nvuillam

import groovy.transform.CompileStatic

/**
 * Placeholder for the in-memory result cache.
 *
 * LintContext (Task 4) references this type so the pool can be threaded through request
 * processing ahead of the cache itself; Task 5 fills in the real caching behaviour. Until
 * then, LintContext.cache is always null and this class carries no state or behaviour.
 */
@CompileStatic
class ResultCache {

}
