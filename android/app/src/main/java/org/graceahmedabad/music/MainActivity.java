package org.graceahmedabad.music;

import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.annotation.NonNull;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

/**
 * Grace Music Android shell loading https://music.graceahmedabad.org
 *
 * Website login uses the web Google button (works). In the app, the live site
 * switches to Capawesome GoogleSignIn, which often cancels after account pick.
 * We register {@link GraceGoogleAuthPlugin} and rewrite the login button to use it,
 * then complete auth via the website's existing /api/auth/login|register endpoints.
 *
 * Offline: Capacitor server.errorPath loads www/offline.html. We also watch
 * connectivity and reload the live site when the device comes back online.
 *
 * Deep links: App Links / custom scheme for /invite/... open the invite page
 * inside the WebView instead of the system browser.
 */
public class MainActivity extends BridgeActivity {

    private static final String LIVE_HOST = "music.graceahmedabad.org";
    private static final String CUSTOM_SCHEME = "org.graceahmedabad.music";

    private ConnectivityManager connectivityManager;
    private ConnectivityManager.NetworkCallback networkCallback;
    private boolean showingOffline = false;
    private boolean reloadScheduled = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Must run before super.onCreate so Android 12+ splash hands off correctly
        SplashScreen.installSplashScreen(this);

        registerPlugin(GraceGoogleAuthPlugin.class);
        registerPlugin(GraceAppPlugin.class);
        bridgeBuilder.addWebViewListener(
            new WebViewListener() {
                @Override
                public void onPageLoaded(WebView webView) {
                    String url = webView.getUrl();
                    if (url != null && url.contains("offline.html")) {
                        showingOffline = true;
                        injectOfflineHelpers(webView);
                    } else {
                        showingOffline = false;
                        injectGraceGoogleLogin(webView);
                    }
                }

                @Override
                public void onReceivedError(WebView webView) {
                    showingOffline = true;
                }

                @Override
                public void onPageStarted(WebView webView) {
                    String url = webView.getUrl();
                    if (url == null || !url.contains("offline.html")) {
                        showingOffline = false;
                    }
                }
            }
        );
        super.onCreate(savedInstanceState);
        registerNetworkCallback();
        // Cold start via App Link / custom scheme (after Bridge is ready)
        handleIncomingLink(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingLink(intent);
    }

    /**
     * Resolve invite deep links into a https URL and load it in the WebView.
     */
    private void handleIncomingLink(Intent intent) {
        if (intent == null) return;
        Uri data = intent.getData();
        if (data == null) return;

        String target = resolveInviteUrl(data);
        if (target == null) return;

        Bridge bridge = getBridge();
        if (bridge == null || bridge.getWebView() == null) return;

        final String loadTarget = target;
        bridge.getWebView().post(() -> {
            try {
                showingOffline = false;
                bridge.getWebView().loadUrl(loadTarget);
            } catch (Exception ignored) {}
        });
    }

    private String resolveInviteUrl(Uri data) {
        String scheme = data.getScheme();
        if (scheme == null) return null;

        if ("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme)) {
            String host = data.getHost();
            String path = data.getPath() != null ? data.getPath() : "";
            if (LIVE_HOST.equalsIgnoreCase(host) && path.startsWith("/invite")) {
                return data.toString();
            }
            return null;
        }

        if (CUSTOM_SCHEME.equalsIgnoreCase(scheme)) {
            // org.graceahmedabad.music://invite/CODE
            // org.graceahmedabad.music:///invite/CODE
            String host = data.getHost();
            String path = data.getPath() != null ? data.getPath() : "";
            String code = null;

            if ("invite".equalsIgnoreCase(host)) {
                code = path.startsWith("/") ? path.substring(1) : path;
            } else if (path.startsWith("/invite/")) {
                code = path.substring("/invite/".length());
            } else if (path.equals("/invite") || "invite".equalsIgnoreCase(path)) {
                code = data.getQueryParameter("code");
            }

            if (code != null) {
                code = code.trim().replaceAll("/+$", "");
            }
            if (code == null || code.isEmpty()) return null;
            return "https://" + LIVE_HOST + "/invite/" + Uri.encode(code);
        }

        return null;
    }

    @Override
    public void onDestroy() {
        unregisterNetworkCallback();
        super.onDestroy();
    }

    private void registerNetworkCallback() {
        connectivityManager =
            (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (connectivityManager == null) return;

        networkCallback =
            new ConnectivityManager.NetworkCallback() {
                @Override
                public void onAvailable(@NonNull Network network) {
                    runOnUiThread(() -> {
                        if (showingOffline || isShowingOfflinePage()) {
                            reloadLiveApp();
                        }
                    });
                }

                @Override
                public void onCapabilitiesChanged(
                    @NonNull Network network,
                    @NonNull NetworkCapabilities caps
                ) {
                    boolean online =
                        caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                        caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
                    if (online) {
                        runOnUiThread(() -> {
                            if (showingOffline || isShowingOfflinePage()) {
                                reloadLiveApp();
                            }
                        });
                    }
                }
            };

        NetworkRequest request =
            new NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build();
        try {
            connectivityManager.registerNetworkCallback(request, networkCallback);
        } catch (Exception ignored) {
            // Older devices / missing permission — offline.html still has Try again
        }
    }

    private void unregisterNetworkCallback() {
        if (connectivityManager != null && networkCallback != null) {
            try {
                connectivityManager.unregisterNetworkCallback(networkCallback);
            } catch (Exception ignored) {}
        }
        networkCallback = null;
    }

    private boolean isShowingOfflinePage() {
        Bridge bridge = getBridge();
        if (bridge == null || bridge.getWebView() == null) return false;
        String url = bridge.getWebView().getUrl();
        return url != null && url.contains("offline.html");
    }

    private void reloadLiveApp() {
        if (reloadScheduled) return;
        Bridge bridge = getBridge();
        if (bridge == null || bridge.getWebView() == null) return;

        String appUrl = bridge.getServerUrl();
        if (appUrl == null || appUrl.trim().isEmpty()) {
            appUrl = bridge.getAppUrl();
        }
        if (appUrl == null || appUrl.trim().isEmpty()) {
            appUrl = "https://music.graceahmedabad.org/";
        }

        reloadScheduled = true;
        showingOffline = false;
        final String target = appUrl;
        bridge.getWebView().post(() -> {
            try {
                bridge.getWebView().loadUrl(target);
            } finally {
                // Allow another retry if this load fails again
                bridge.getWebView().postDelayed(() -> reloadScheduled = false, 2500);
            }
        });
    }

    private void injectOfflineHelpers(WebView webView) {
        Bridge bridge = getBridge();
        String appUrl = "https://music.graceahmedabad.org/";
        if (bridge != null) {
            String configured = bridge.getServerUrl();
            if (configured == null || configured.trim().isEmpty()) {
                configured = bridge.getAppUrl();
            }
            if (configured != null && !configured.trim().isEmpty()) {
                appUrl = configured;
            }
        }
        if (!appUrl.endsWith("/")) {
            appUrl = appUrl + "/";
        }

        String escaped = appUrl.replace("\\", "\\\\").replace("'", "\\'");
        String js =
            "(function(){ try { window.__GRACE_APP_URL = '" +
            escaped +
            "'; } catch(e) {} })();";
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
