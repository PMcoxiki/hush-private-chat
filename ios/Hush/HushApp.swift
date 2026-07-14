import SwiftUI

enum AppConfiguration {
    static let webRootURL = Bundle.main.resourceURL!
        .appendingPathComponent("WebApp", isDirectory: true)
    static let indexURL = webRootURL.appendingPathComponent("index.html")
}

@main
struct HushApp: App {
    var body: some Scene {
        WindowGroup {
            ChatWebView()
                .ignoresSafeArea(.container, edges: .bottom)
        }
    }
}
