module.exports = {
	appId: 1,
	appSecret: 'your appSecret',
	tokens: 'your device token',
	redis: {
		port: 6379,
		host: '127.0.0.1'
	},
	callback: function () {
		console.log(JSON.stringify(arguments, null, 2));
	}
};
