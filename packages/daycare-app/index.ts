import * as SplashScreen from "expo-splash-screen";

SplashScreen.setOptions({ fade: true, duration: 300 });
void SplashScreen.preventAutoHideAsync();

import "./sources/unistyles";
import "expo-router/entry";
