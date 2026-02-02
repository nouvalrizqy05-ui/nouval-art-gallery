const { merge } = require('webpack-merge')
const commonConfiguration = require('./webpack.common.js')
const path = require('path')

module.exports = merge(
    commonConfiguration,
    {
        mode: 'development',
        devServer:
        {
            host: '0.0.0.0',
            port: 8080,
            static: {
                directory: path.join(__dirname, '../static'), // Menggantikan contentBase
                watch: true, // Menggantikan watchContentBase
            },
            open: true,
            historyApiFallback: true,
            allowedHosts: 'all', // Menggantikan disableHostCheck
            client: {
                overlay: true, // Menggantikan overlay di root
                logging: 'none', // Menggantikan noInfo
            },
            setupMiddlewares: (middlewares, devServer) => {
                const port = devServer.options.port
                const https = devServer.options.https ? 's' : ''
                const domain2 = `http${https}://localhost:${port}`
                
                console.log(`Project running at:\n  - \x1b[1m\x1b[34m${domain2}\x1b[39m\x1b[22m`)
                return middlewares
            }
        }
    }
)