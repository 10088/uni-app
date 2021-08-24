'use strict';

async function teardown() {
    const program = global.program;
    program && program.teardown();
    await new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, 3000);
    });
}

module.exports = teardown;
