import Foundation
import UserNotifications

final class PrivateMessageNotificationManager: NSObject, UNUserNotificationCenterDelegate {
    static let shared = PrivateMessageNotificationManager()

    private let center = UNUserNotificationCenter.current()
    private var requestedAuthorization = false
    private var handledMessageIDs = Set<String>()

    private override init() {
        super.init()
    }

    func configure() {
        center.delegate = self
    }

    func prepare() {
        guard !requestedAuthorization else { return }
        requestedAuthorization = true
        center.getNotificationSettings { [weak self] settings in
            guard let self else { return }
            if settings.authorizationStatus == .notDetermined {
                self.center.requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
            }
        }
    }

    func notifyIncomingMessage(id: String) {
        guard id.range(of: "^[A-Za-z0-9-]{8,80}$", options: .regularExpression) != nil,
              handledMessageIDs.insert(id).inserted else { return }

        center.getNotificationSettings { [weak self] settings in
            guard let self else { return }
            switch settings.authorizationStatus {
            case .authorized, .provisional, .ephemeral:
                self.scheduleGenericReplyNotification(id: id)
            case .notDetermined:
                self.center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
                    if granted {
                        self.scheduleGenericReplyNotification(id: id)
                    }
                }
            default:
                break
            }
        }
    }

    private func scheduleGenericReplyNotification(id: String) {
        let content = UNMutableNotificationContent()
        content.title = "Hush"
        content.body = "你有一条新回复"
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: "private-reply-\(id)",
            content: content,
            trigger: nil
        )
        center.add(request)
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .list, .sound])
    }
}
