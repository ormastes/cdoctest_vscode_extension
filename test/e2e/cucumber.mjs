export default {
    paths: ['test/e2e/features/**/*.feature'],
    require: ['out/test/e2e/steps/**/*.js', 'out/test/e2e/support/**/*.js'],
    requireModule: [],
    format: [
        'progress-bar',
        'html:gen/cucumber-report.html',
        'json:gen/cucumber-report.json',
        '@cucumber/pretty-formatter'
    ],
    formatOptions: {
        snippetInterface: 'async-await'
    },
    parallel: 1,
    retry: 1,
    retryTagFilter: '@flaky',
    strict: true,
    failFast: false,
    dryRun: false,
    forceExit: false
};