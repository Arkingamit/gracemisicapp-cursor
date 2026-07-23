import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        // Register for push notifications
        application.registerForRemoteNotifications()
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
    }

    func applicationWillTerminate(_ application: UIApplication) {
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Custom scheme: org.graceahmedabad.music://invite/CODE → load https invite
        if let https = Self.httpsInviteURL(from: url) {
            loadInWebView(https)
            NotificationCenter.default.post(name: .capacitorOpenUniversalLink, object: ["url": https])
            return true
        }
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        if userActivity.activityType == NSUserActivityTypeBrowsingWeb, let url = userActivity.webpageURL {
            if url.host?.lowercased() == "music.graceahmedabad.org",
               url.path.hasPrefix("/invite") {
                loadInWebView(url)
            }
            NotificationCenter.default.post(name: .capacitorOpenUniversalLink, object: ["url": url])
            return true
        }
        return false
    }

    private func loadInWebView(_ url: URL) {
        DispatchQueue.main.async {
            guard let bridgeVC = self.window?.rootViewController as? CAPBridgeViewController,
                  let webView = bridgeVC.bridge?.webView else {
                return
            }
            webView.load(URLRequest(url: url))
        }
    }

    /// Maps custom-scheme invite URLs to the live https invite page.
    private static func httpsInviteURL(from url: URL) -> URL? {
        guard url.scheme?.lowercased() == "org.graceahmedabad.music" else { return nil }

        var code: String?
        if url.host?.lowercased() == "invite" {
            code = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        } else if url.path.hasPrefix("/invite/") {
            code = String(url.path.dropFirst("/invite/".count))
        } else if let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems {
            code = items.first(where: { $0.name == "code" })?.value
        }

        guard let raw = code?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty,
              let encoded = raw.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed),
              let https = URL(string: "https://music.graceahmedabad.org/invite/\(encoded)") else {
            return nil
        }
        return https
    }
}
