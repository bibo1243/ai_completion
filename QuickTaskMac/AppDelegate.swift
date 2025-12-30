import SwiftUI
import AppKit
import Carbon.HIToolbox

class AppDelegate: NSObject, NSApplicationDelegate {
    var statusBarItem: NSStatusItem?
    var popover: NSPopover?
    var inputWindow: NSWindow?
    var eventMonitor: Any?
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Create status bar item
        statusBarItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        
        if let button = statusBarItem?.button {
            button.image = NSImage(systemSymbolName: "checkmark.circle.fill", accessibilityDescription: "Quick Task")
            button.action = #selector(togglePopover)
            button.target = self
        }
        
        // Setup popover
        popover = NSPopover()
        popover?.contentSize = NSSize(width: 400, height: 500)
        popover?.behavior = .transient
        popover?.contentViewController = NSHostingController(rootView: TaskInputView(closeAction: { [weak self] in
            self?.closePopover()
        }))
        
        // Register global hotkey (Cmd+Shift+I)
        registerGlobalHotkey()
        
        // Hide dock icon
        NSApp.setActivationPolicy(.accessory)
    }
    
    func registerGlobalHotkey() {
        // Using NSEvent global monitor for Cmd+Shift+I
        eventMonitor = NSEvent.addGlobalMonitorForEvents(matching: .keyDown) { [weak self] event in
            // Check for Cmd+Shift+I
            if event.modifierFlags.contains([.command, .shift]) && event.keyCode == 34 { // 34 is 'i'
                DispatchQueue.main.async {
                    self?.showInputWindow()
                }
            }
        }
        
        // Also add local monitor for when app is active
        NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            if event.modifierFlags.contains([.command, .shift]) && event.keyCode == 34 {
                DispatchQueue.main.async {
                    self?.showInputWindow()
                }
                return nil
            }
            // Escape to close
            if event.keyCode == 53 { // Escape key
                self?.closeInputWindow()
                return nil
            }
            return event
        }
    }
    
    @objc func togglePopover() {
        if let popover = popover {
            if popover.isShown {
                closePopover()
            } else {
                showInputWindow()
            }
        }
    }
    
    func showInputWindow() {
        if inputWindow == nil {
            let contentView = TaskInputView(closeAction: { [weak self] in
                self?.closeInputWindow()
            })
            
            inputWindow = NSWindow(
                contentRect: NSRect(x: 0, y: 0, width: 480, height: 600),
                styleMask: [.titled, .closable, .fullSizeContentView],
                backing: .buffered,
                defer: false
            )
            inputWindow?.titlebarAppearsTransparent = true
            inputWindow?.titleVisibility = .hidden
            inputWindow?.isMovableByWindowBackground = true
            inputWindow?.backgroundColor = .clear
            inputWindow?.contentView = NSHostingView(rootView: contentView)
            inputWindow?.level = .floating
            inputWindow?.isReleasedWhenClosed = false
        }
        
        // Center on screen
        if let screen = NSScreen.main {
            let screenRect = screen.visibleFrame
            let windowRect = inputWindow!.frame
            let x = screenRect.origin.x + (screenRect.width - windowRect.width) / 2
            let y = screenRect.origin.y + (screenRect.height - windowRect.height) / 2 + 100
            inputWindow?.setFrameOrigin(NSPoint(x: x, y: y))
        }
        
        inputWindow?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
    
    func closeInputWindow() {
        inputWindow?.close()
        inputWindow = nil
    }
    
    func closePopover() {
        popover?.performClose(nil)
    }
}
