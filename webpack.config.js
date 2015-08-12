module.exports = {
    context: __dirname + "/public",
    entry: "./jsx/app.jsx",
    output: {
        path: __dirname + "/public/dist",
        filename: "bundle.js"
    },
    module: {
    	loaders: [
	    	{
	    		test: /\.jsx$/,
	    		loader: 'babel'
	    	},
	    	{
	    		test: /\.less$/,
	    		loader: 'style-loader!css-loader!less-loader'
	    	},
    	]
    }
}