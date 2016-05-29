global.document = require('jsdom').jsdom('<body></body>');
global.window = document.defaultView;
