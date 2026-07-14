import SwiftUI

enum AppConfiguration {
    static let webURL = URL(string: "https://pmcoxiki.github.io/hush-private-chat/")!
    static let allowedHost = webURL.host!
}

@main
struct HushApp: App {
    var body: some Scene {
        WindowGroup {
            ChatWebView(url: AppConfiguration.webURL)
                .ignoresSafeArea(.container, edges: .bottom)
        }
    }
}
