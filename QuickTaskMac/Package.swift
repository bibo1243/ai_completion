// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "QuickTask",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "QuickTask", targets: ["QuickTask"])
    ],
    targets: [
        .executableTarget(
            name: "QuickTask",
            path: ".",
            exclude: ["README.md", "QuickTask.xcodeproj", "QuickTask.entitlements"],
            sources: [
                "QuickTaskApp.swift",
                "AppDelegate.swift", 
                "TaskInputView.swift",
                "SupabaseService.swift",
                "SettingsView.swift"
            ]
        )
    ]
)
