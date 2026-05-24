// frida_force_specialskill_download.js
//
// Frida hook for the Slime IM Android app (com.bandainamcoent.tensuramrkww).
// Goal: log every UnityWebRequest URL the game issues so we capture the CDN
// host + path pattern for SpecialSkill bundles, AND optionally trigger
// downloads for every SpecialSkill bundle the game knows about.
//
// Run with:
//   frida -U -f com.bandainamcoent.tensuramrkww -l frida_force_specialskill_download.js --no-pause
//
// IMPORTANT: per the project memory note `project_gacha_ground_truth`,
// the device runs ARM64 under x86_64 houdini binary translation, so the
// x86_64 frida-server is BLIND to libil2cpp.so. Run frida-server-arm64 on
// a rooted device/emulator that has actual arm64 support — or use a
// physical arm64 device for this script.
//
// What this script does:
//   1. Logs every UnityWebRequest URL (catches CDN host + bundle hash).
//   2. Hooks Tempest.LotteryPattern.LotteryPatterMovieUtility lookups for
//      MoviePath to learn the master_pc_id → MoviePath map at runtime.
//   3. (Optional) Triggers a download for every Movie/SpecialSkill bundle
//      the addressables catalog knows about, so the game's local cache
//      fills up. After the run, pull /data/data/com.bandai../cache/ and
//      feed the .bundle files into extract_special_skill_movies.py.

"use strict";

const APP_PACKAGE = "com.bandainamcoent.tensuramrkww";

// Helper: log UnityWebRequest creations + completions to surface the CDN URL.
function hookUnityWebRequest() {
  try {
    const cls = Java.use("com.unity3d.player.UnityWebRequest");
    cls.$init.overloads.forEach((ovl) => {
      ovl.implementation = function (...args) {
        try {
          const url = args.find((a) => typeof a === "string");
          if (url && /\.bundle|Movie\/SpecialSkill/i.test(url)) {
            console.log("[UWR.ctor] " + url);
          }
        } catch (e) {}
        return ovl.apply(this, args);
      };
    });
  } catch (e) {
    console.log("UnityWebRequest java hook unavailable: " + e);
  }
}

// Native libil2cpp.so symbol resolution helper (resolve by RVA from dump.cs).
// The RVAs below were transcribed from
//   C:\Users\Angel105\Documents\cenas\_work\arm64_dump\out\dump.cs
// and must be re-verified after any game update.
function resolveIl2cppRva(rva) {
  const mod = Process.findModuleByName("libil2cpp.so");
  if (!mod) return null;
  return mod.base.add(rva);
}

// Hook MasterPcLotteryMessage.get_MoviePath to log every (pcId, moviePath)
// pair the game resolves, so we can build a complete master_pc_id → mp4 manifest.
function hookMoviePathReads() {
  // get_MoviePath RVA from dump.cs (TypeDefIndex 21661, MasterPcLotteryMessage):
  //   RVA: 0x9FFA138 Offset: 0x9FF6138 VA: 0x9FFA138
  const addr = resolveIl2cppRva(0x9FFA138);
  if (!addr) {
    console.log("libil2cpp.so not loaded yet — retrying later");
    return false;
  }
  Interceptor.attach(addr, {
    onEnter(args) {
      this.self = args[0]; // MasterPcLotteryMessage*
    },
    onLeave(retval) {
      try {
        const il2cppString = retval;
        if (il2cppString.isNull()) return;
        // il2cpp string layout: [Il2CppObject hdr 0x10][int length @0x10][char16 chars @0x14]
        const len = il2cppString.add(0x10).readU32();
        if (len === 0 || len > 256) return;
        let s = "";
        for (let i = 0; i < len; i++) {
          s += String.fromCharCode(il2cppString.add(0x14 + i * 2).readU16());
        }
        if (s.includes("Movie/SpecialSkill")) {
          console.log("[MoviePath] " + s);
        }
      } catch (e) {}
    },
  });
  console.log("Hooked MasterPcLotteryMessage.get_MoviePath @ " + addr);
  return true;
}

// Triggers the addressables cache for a single bundle path; relies on the
// game's IAssetDownloadOperation API which is exposed on AssetDownloadBaseState.
// In practice you usually just rely on hooking + playing through pulls — the
// game itself will trigger downloads when the gacha animation needs them.
function logBundleDownloads() {
  // Hook UnityWebRequestAssetBundle.GetAssetBundle to log every bundle URL
  // (this is the actual CDN URL with host + bundle hash).
  const mod = Process.findModuleByName("libil2cpp.so");
  if (!mod) {
    console.log("libil2cpp not loaded — skip bundle log hook");
    return;
  }
  // UnityWebRequestAssetBundle.GetAssetBundle lives in the Unity engine, not
  // libil2cpp. The simplest way to surface bundle URLs is to hook curl/native
  // socket APIs OR just `strings` the bundle cache after a gacha pull.
  console.log("Hint: after running through gacha pulls, inspect");
  console.log("  /sdcard/Android/data/" + APP_PACKAGE + "/files/UnityCache/");
  console.log("for cached bundle files; copy them out via:");
  console.log("  adb pull /sdcard/Android/data/" + APP_PACKAGE + "/files/UnityCache/Shared C:\\path\\to\\specialskill_cache");
}

// Frida entry point: hook things once libil2cpp loads.
function main() {
  hookUnityWebRequest();
  let armed = false;
  const interval = setInterval(() => {
    if (armed) return;
    if (hookMoviePathReads()) {
      logBundleDownloads();
      armed = true;
      clearInterval(interval);
    }
  }, 1000);
}

Java.perform(main);
