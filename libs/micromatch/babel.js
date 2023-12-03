#!/usr/bin/node
const fs = require('fs');
const babel = require("@babel/core");
const files = process.argv.slice(2);
let i = 0;
(async function next() {
	if (i == files.length) {
		return console.log('Finished');
	}
	console.log('transforming file: ' + files[i]);
	var code = fs.readFileSync(files[i]);
	var output = babel.transformSync(code, {
		"presets": [
			[
				"@babel/preset-env",
				{
					"targets": {
						"chrome": "40",
					},
					//"useBuiltIns":
					//	"usage",
					//"corejs": "3.6.5"
				}
			]
		]
	});
	fs.writeFileSync(files[i].replace(".js", "") + "-es5.js", output.code);
	next(++i);
})()
