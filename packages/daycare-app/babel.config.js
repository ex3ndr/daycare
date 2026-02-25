module.exports = function (api) {
    api.cache(true);
    return {
        presets: ["babel-preset-expo"],
        env: {
            production: {
                plugins: process.env.IS_WEB_PRODUCTION ? [] : ["transform-remove-console"]
            }
        },
        plugins: ["react-native-worklets/plugin", ["react-native-unistyles/plugin", { root: "sources" }]]
    };
};
