package com.grace.app;

import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

/**
 * Grace Music Android shell loading https://music.graceahmedabad.org
 *
 * Website login uses the web Google button (works). In the app, the live site
 * switches to Capawesome GoogleSignIn, which often cancels after account pick.
 * We register {@link GraceGoogleAuthPlugin} and rewrite the login button to use it,
 * then complete auth via the website's existing /api/auth/login|register endpoints.
 */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(GraceGoogleAuthPlugin.class);
        registerPlugin(GraceAppPlugin.class);
        bridgeBuilder.addWebViewListener(
            new WebViewListener() {
                @Override
                public void onPageLoaded(WebView webView) {
                    injectGraceGoogleLogin(webView);
                    injectKeyboardHelpers(webView);
                    injectNotificationPermissionPrompt(webView);
                }
            }
        );
        super.onCreate(savedInstanceState);
        // Prefer pan over resize so fixed modals don't leave a huge grey gap above the keyboard
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_PAN);
    }

    private void injectKeyboardHelpers(WebView webView) {
        // language=javascript
        String js =
            "(function () {" +
            "  try {" +
            "    if (window.__graceKeyboardHelpersInstalled) return;" +
            "    window.__graceKeyboardHelpersInstalled = true;" +
            "    document.addEventListener('focusin', function (e) {" +
            "      var t = e.target;" +
            "      if (!t) return;" +
            "      var tag = (t.tagName || '').toLowerCase();" +
            "      if (tag !== 'input' && tag !== 'textarea' && !t.isContentEditable) return;" +
            "      setTimeout(function () {" +
            "        try { t.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' }); } catch (_) {}" +
            "      }, 300);" +
            "    }, true);" +
            "  } catch (e) {" +
            "    console.error('[Grace] keyboard helpers failed', e);" +
            "  }" +
            "})();";

        webView.post(() -> webView.evaluateJavascript(js, null));
    }

    /**
     * Until the website prompt UI is deployed, ask for Android notification
     * permission after login using the system dialog.
     */
    private void injectNotificationPermissionPrompt(WebView webView) {
        // language=javascript
        String js =
            "(function () {" +
            "  try {" +
            "    if (window.__gracePushPromptInstalled) return;" +
            "    window.__gracePushPromptInstalled = true;" +
            "    var C = window.Capacitor;" +
            "    if (!C || !C.Plugins || !C.Plugins.PushNotifications) return;" +
            "" +
            "    function dismissedRecently() {" +
            "      try {" +
            "        var at = Number(localStorage.getItem('grace_push_prompt_dismissed_at') || '0');" +
            "        return at && (Date.now() - at) < (3 * 24 * 60 * 60 * 1000);" +
            "      } catch (_) { return false; }" +
            "    }" +
            "" +
            "    async function ensurePush() {" +
            "      try {" +
            "        var me = await fetch('/api/auth/me', { credentials: 'include' });" +
            "        if (!me.ok) return;" +
            "        var Push = C.Plugins.PushNotifications;" +
            "        var status = await Push.checkPermissions();" +
            "        if (status.receive === 'granted') {" +
            "          try {" +
            "            await Push.createChannel({" +
            "              id: 'default', name: 'Grace Music'," +
            "              description: 'Song sets, groups, and app updates'," +
            "              importance: 5, visibility: 1, sound: 'default', vibration: true" +
            "            });" +
            "          } catch (_) {}" +
            "          await Push.register();" +
            "          return;" +
            "        }" +
            "        if (dismissedRecently()) return;" +
            "        if (status.receive === 'denied') {" +
            "          var openSettings = window.confirm(" +
            "            'Notifications are off. Open settings to allow Grace Music notifications?'" +
            "          );" +
            "          if (openSettings && C.Plugins.GraceApp) {" +
            "            await C.Plugins.GraceApp.openNotificationSettings();" +
            "          } else {" +
            "            try { localStorage.setItem('grace_push_prompt_dismissed_at', String(Date.now())); } catch (_) {}" +
            "          }" +
            "          return;" +
            "        }" +
            "        var allow = window.confirm(" +
            "          'Allow Grace Music to send you notifications for sets and updates?'" +
            "        );" +
            "        if (!allow) {" +
            "          try { localStorage.setItem('grace_push_prompt_dismissed_at', String(Date.now())); } catch (_) {}" +
            "          return;" +
            "        }" +
            "        status = await Push.requestPermissions();" +
            "        if (status.receive === 'granted') {" +
            "          try {" +
            "            await Push.createChannel({" +
            "              id: 'default', name: 'Grace Music'," +
            "              description: 'Song sets, groups, and app updates'," +
            "              importance: 5, visibility: 1, sound: 'default', vibration: true" +
            "            });" +
            "          } catch (_) {}" +
            "          await Push.register();" +
            "        }" +
            "      } catch (err) {" +
            "        console.error('[Grace] push prompt failed', err);" +
            "      }" +
            "    }" +
            "" +
            "    setTimeout(ensurePush, 2000);" +
            "  } catch (e) {" +
            "    console.error('[Grace] push inject failed', e);" +
            "  }" +
            "})();";

        webView.post(() -> webView.evaluateJavascript(js, null));
    }

    private void injectGraceGoogleLogin(WebView webView) {
        // language=javascript
        String js =
            "(function () {" +
            "  try {" +
            "    if (window.__graceGoogleLoginInstalled) return;" +
            "    window.__graceGoogleLoginInstalled = true;" +
            "" +
            "    function decodeJwt(token) {" +
            "      var payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');" +
            "      while (payload.length % 4) payload += '=';" +
            "      return JSON.parse(atob(payload));" +
            "    }" +
            "" +
            "    async function completeWebsiteLogin(idToken) {" +
            "      var decoded = decodeJwt(idToken);" +
            "      if (!decoded.email || !decoded.sub) throw new Error('Google token missing email');" +
            "      var password = 'google_' + decoded.sub;" +
            "      var headers = { 'Content-Type': 'application/json' };" +
            "      var loginRes = await fetch('/api/auth/login', {" +
            "        method: 'POST', credentials: 'include', headers: headers," +
            "        body: JSON.stringify({ email: decoded.email, password: password })" +
            "      });" +
            "      if (!loginRes.ok) {" +
            "        var username = (decoded.name && String(decoded.name).trim()) || decoded.email.split('@')[0];" +
            "        loginRes = await fetch('/api/auth/register', {" +
            "          method: 'POST', credentials: 'include', headers: headers," +
            "          body: JSON.stringify({ username: username, email: decoded.email, password: password })" +
            "        });" +
            "      }" +
            "      var data = await loginRes.json().catch(function () { return {}; });" +
            "      if (!loginRes.ok) throw new Error(data.error || 'Login failed');" +
            "      window.location.href = '/';" +
            "    }" +
            "" +
            "    async function runGraceGoogleLogin(ev) {" +
            "      if (ev) { ev.preventDefault(); ev.stopPropagation(); }" +
            "      try {" +
            "        var C = window.Capacitor;" +
            "        if (!C || !C.Plugins || !C.Plugins.GraceGoogleAuth) {" +
            "          throw new Error('Native Google auth is unavailable');" +
            "        }" +
            "        var result = await C.Plugins.GraceGoogleAuth.signIn();" +
            "        if (!result || !result.idToken) throw new Error('No Google ID token');" +
            "        await completeWebsiteLogin(result.idToken);" +
            "      } catch (err) {" +
            "        var msg = (err && (err.message || err.errorMessage)) || String(err);" +
            "        if (/cancel/i.test(msg)) {" +
            "          alert('Sign-in was canceled. Please try again.');" +
            "        } else {" +
            "          alert('Google Login Error: ' + msg);" +
            "        }" +
            "        console.error('[Grace] Google login failed', err);" +
            "      }" +
            "    }" +
            "" +
            "    window.__graceRunGoogleLogin = runGraceGoogleLogin;" +
            "" +
            "    function wireButtons(root) {" +
            "      var nodes = (root || document).querySelectorAll('button, a, [role=\"button\"]');" +
            "      for (var i = 0; i < nodes.length; i++) {" +
            "        var el = nodes[i];" +
            "        if (el.__graceGoogleWired) continue;" +
            "        var text = (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim();" +
            "        if (!/continue with google/i.test(text)) continue;" +
            "        el.__graceGoogleWired = true;" +
            "        el.addEventListener('click', function (ev) {" +
            "          ev.preventDefault();" +
            "          ev.stopImmediatePropagation();" +
            "          runGraceGoogleLogin(ev);" +
            "        }, true);" +
            "      }" +
            "    }" +
            "" +
            "    wireButtons(document);" +
            "    var obs = new MutationObserver(function (mutations) {" +
            "      for (var i = 0; i < mutations.length; i++) {" +
            "        var m = mutations[i];" +
            "        for (var j = 0; j < m.addedNodes.length; j++) {" +
            "          var n = m.addedNodes[j];" +
            "          if (n && n.nodeType === 1) wireButtons(n);" +
            "        }" +
            "      }" +
            "    });" +
            "    obs.observe(document.documentElement, { childList: true, subtree: true });" +
            "  } catch (e) {" +
            "    console.error('[Grace] login inject failed', e);" +
            "  }" +
            "})();";

        webView.post(() -> webView.evaluateJavascript(js, null));
    }
}
