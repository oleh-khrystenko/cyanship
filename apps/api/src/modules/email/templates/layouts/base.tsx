import {
    Body,
    Container,
    Head,
    Html,
    Section,
    Text,
} from '@react-email/components';
import { EMAIL_COLORS } from '@cyanship/types';

interface BaseLayoutProps {
    lang: string;
    children: React.ReactNode;
}

export function BaseLayout({ lang, children }: BaseLayoutProps) {
    return (
        <Html lang={lang}>
            <Head />
            <Body style={body}>
                <Container style={container}>
                    <Section style={header}>
                        <Text style={brand}>CyanShip</Text>
                    </Section>
                    {children}
                </Container>
            </Body>
        </Html>
    );
}

const body: React.CSSProperties = {
    fontFamily: 'sans-serif',
    backgroundColor: EMAIL_COLORS.background,
    padding: '40px 0',
};

const container: React.CSSProperties = {
    maxWidth: '480px',
    margin: '0 auto',
    backgroundColor: EMAIL_COLORS.card,
    borderRadius: '12px',
    padding: '40px',
    textAlign: 'center' as const,
};

const header: React.CSSProperties = {
    marginBottom: '8px',
};

const brand: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: 700,
    color: EMAIL_COLORS.foreground,
    margin: '0',
};
