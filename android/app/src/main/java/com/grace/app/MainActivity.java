package com.grace.app;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

/**
 * Grace Music Android shell.
 *
 * The WebView loads the live website. Website Google login works (web GIS button),
 * but Capacitor uses the native GoogleSignIn plugin. If that plugin is initialized
 * with OAuth scopes, Android shows a second consent after account selection that
 * often hangs / cancels. This activity patches the plugin on every page load so
 * sign-in only requests an ID token (same as web).
 */
public class MainActivity extends BridgeActivity {

    private static final String GOOGLE_WEB_CLIENT_ID =
        "810353645969-dmsbou0itk6475tap5j8qq7ejvs68dm7.apps.googleusercontent.com";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        bridgeBuilder.addWebViewListener(
            new WebViewListener() {
                @Override
                public void onPageLoaded(WebView webView) {
                    injectGoogleSignInFix(webView);
                }
            }
        );
        super.onCreate(savedInstanceState);
    }

    private void injectGoogleSignInFix(WebView webView) {
        // language=javascript
        String js =
            "(function () {" +
            "  try {" +
            "    var C = window.Capacitor;" +
            "    if (!C || !C.Plugins || !C.Plugins.GoogleSignIn) return;" +
            "    var g = C.Plugins.GoogleSignIn;" +
            "    var clientId = '" +
            GOOGLE_WEB_CLIENT_ID +
            "';" +
            "    if (!g.__gracePatched) {" +
            "      g.__gracePatched = true;" +
            "      var origInit = g.initialize.bind(g);" +
            "      var origSignIn = g.signIn.bind(g);" +
            "      g.initialize = function (opts) {" +
            "        opts = Object.assign({}, opts || {});" +
            "        delete opts.scopes;" +
            "        if (!opts.clientId) opts.clientId = clientId;" +
            "        return origInit(opts);" +
            "      };" +
            "      g.signIn = function (opts) {" +
            "        return g.initialize({ clientId: clientId }).then(function () {" +
            "          return origSignIn(opts || {});" +
            "        });" +
            "      };" +
            "    }" +
            "    // Clear any scopes already applied by the website AppProviders" +
            "    g.initialize({ clientId: clientId });" +
            "    var n = 0;" +
            "    var timer = setInterval(function () {" +
            "      try { g.initialize({ clientId: clientId }); } catch (e) {}" +
            "      if (++n >= 20) clearInterval(timer);" +
            "    }, 400);" +
            "  } catch (e) {" +
            "    console.error('[Grace] GoogleSignIn patch failed', e);" +
            "  }" +
            "})();";

        webView.post(() -> webView.evaluateJavascript(js, null));
    }
}
