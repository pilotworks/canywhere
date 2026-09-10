import SwiftUI
import UIKit

// MARK: - Haptic Feedback Manager

@MainActor
final class Haptics {
    static let shared = Haptics()
    private init() {}

    func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .medium) {
        let generator = UIImpactFeedbackGenerator(style: style)
        generator.prepare()
        generator.impactOccurred()
    }

    func notification(_ type: UINotificationFeedbackGenerator.FeedbackType) {
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(type)
    }

    func selection() {
        let generator = UISelectionFeedbackGenerator()
        generator.prepare()
        generator.selectionChanged()
    }
}

// MARK: - Theme Constants & Colors

enum Theme {
    static let primaryGradient = LinearGradient(
        colors: [Color(red: 0.20, green: 0.45, blue: 0.98), Color(red: 0.38, green: 0.32, blue: 0.95)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let userBubbleGradient = LinearGradient(
        colors: [Color(red: 0.15, green: 0.48, blue: 0.98), Color(red: 0.32, green: 0.35, blue: 0.92)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let purpleGradient = LinearGradient(
        colors: [Color.purple.opacity(0.8), Color.indigo],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let subtleBorder = Color.primary.opacity(0.08)
    static let darkCardBackground = Color(red: 0.11, green: 0.12, blue: 0.14)
}

// MARK: - View Modifiers & Extensions

struct CardStyleModifier: ViewModifier {
    var cornerRadius: CGFloat = 16
    var backgroundColor: Color = Color(uiColor: .secondarySystemGroupedBackground)

    func body(content: Content) -> some View {
        content
            .background(backgroundColor)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(Theme.subtleBorder, lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 3)
    }
}

struct GlassPillModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(.ultraThinMaterial)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(Theme.subtleBorder, lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.04), radius: 6, x: 0, y: 2)
    }
}

extension View {
    func cardStyle(cornerRadius: CGFloat = 16, backgroundColor: Color = Color(uiColor: .secondarySystemGroupedBackground)) -> some View {
        modifier(CardStyleModifier(cornerRadius: cornerRadius, backgroundColor: backgroundColor))
    }

    func glassPill() -> some View {
        modifier(GlassPillModifier())
    }
}

// MARK: - Pulsing Dot Indicator

struct PulsingDot: View {
    let color: Color

    init(color: Color = .green) {
        self.color = color
    }

    var body: some View {
        PhaseAnimator([false, true]) { isPulsing in
            ZStack {
                Circle()
                    .fill(color.opacity(0.35))
                    .frame(width: 14, height: 14)
                    .scaleEffect(isPulsing ? 1.45 : 0.85)
                    .opacity(isPulsing ? 0.08 : 0.75)

                Circle()
                    .fill(color)
                    .frame(width: 8, height: 8)
                    .shadow(color: color.opacity(isPulsing ? 0.6 : 0.2), radius: isPulsing ? 3 : 1)
            }
            .frame(width: 14, height: 14)
            .allowsHitTesting(false)
        } animation: { _ in
            .easeInOut(duration: 1.2)
        }
    }
}

// MARK: - Shimmer / Shining Text Indicator

struct ShimmerText: View {
    let text: String
    var font: Font = .subheadline
    var baseColor: Color = .secondary
    var highlightColor: Color = .white

    @State private var phase: CGFloat = -1.0

    var body: some View {
        Text(text)
            .font(font)
            .foregroundStyle(baseColor)
            .overlay {
                GeometryReader { geo in
                    let width = geo.size.width
                    LinearGradient(
                        colors: [
                            .clear,
                            highlightColor.opacity(0.85),
                            .clear
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(width: max(width * 0.8, 30))
                    .offset(x: phase * (width + 40) - 20)
                    .mask {
                        Text(text)
                            .font(font)
                    }
                }
            }
            .onAppear {
                withAnimation(.linear(duration: 1.6).repeatForever(autoreverses: false)) {
                    phase = 1.2
                }
            }
    }
}

// MARK: - Provider Logo & Vectors

struct AntigravityArchShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let w = rect.width
        let h = rect.height
        let ox = rect.minX
        let oy = rect.minY
        func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: ox + (x / 24.0) * w, y: oy + (y / 24.0) * h)
        }

        path.move(to: pt(21.751, 22.607))
        path.addCurve(
            to: pt(23.259, 21.099),
            control1: pt(21.751 + 1.34, 22.607 + 1.005),
            control2: pt(21.751 + 3.35, 22.607 + 0.335)
        )
        path.addCurve(
            to: pt(12.037, 1.0),
            control1: pt(17.73, 15.74),
            control2: pt(18.904, 1.0)
        )
        path.addCurve(
            to: pt(0.815, 21.1),
            control1: pt(5.17, 1.0),
            control2: pt(6.342, 15.74)
        )
        path.addCurve(
            to: pt(2.322, 22.606),
            control1: pt(0.815 - 2.01, 21.1 + 2.009),
            control2: pt(0.815 + 0.167, 21.1 + 2.511)
        )
        path.addCurve(
            to: pt(12.037, 12.892),
            control1: pt(2.322 + 5.192, 22.606 - 3.517),
            control2: pt(7.179, 12.892)
        )
        path.addCurve(
            to: pt(21.751, 22.607),
            control1: pt(16.894, 12.892),
            control2: pt(21.751 - 5.192, 22.607 - 3.518)
        )
        path.closeSubpath()
        return path
    }
}

struct ProviderLogoView: View {
    let providerId: String?
    var size: CGFloat = 20

    var isAgy: Bool {
        providerId == "agy"
    }

    var body: some View {
        if isAgy {
            AntigravityArchShape()
                .fill(
                    LinearGradient(
                        colors: [
                            Color(red: 0.95, green: 0.35, blue: 0.22), // #F15A38 (Coral)
                            Color(red: 0.96, green: 0.58, blue: 0.18), // #F5932D (Amber)
                            Color(red: 0.55, green: 0.75, blue: 0.27), // #8DBF44 (Yellow-Green)
                            Color(red: 0.23, green: 0.61, blue: 0.96), // #3B9CF6 (Sky Blue)
                            Color(red: 0.15, green: 0.39, blue: 0.92)  // #2563EB (Google Blue)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: size, height: size)
        } else {
            // OpenAI Codex Logo (Emerald Terminal / Chevron)
            Image(systemName: "terminal.fill")
                .resizable()
                .scaledToFit()
                .foregroundStyle(Color(red: 0.06, green: 0.64, blue: 0.50)) // #10A37F (OpenAI Green)
                .frame(width: size * 0.85, height: size * 0.85)
        }
    }
}

