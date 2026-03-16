"use client";

import {
  Document,
  Page,
  pdf,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { Slide } from "./slides-viewer";

// Professional styles for VC pitch deck
const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#ffffff",
    padding: 60,
    justifyContent: "flex-start",
  },
  slideNumber: {
    position: "absolute",
    bottom: 30,
    right: 40,
    fontSize: 10,
    color: "#94a3b8",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 40,
    lineHeight: 1.2,
  },
  bulletContainer: {
    flexDirection: "column",
    gap: 16,
  },
  bulletItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#3b82f6",
    marginTop: 6,
  },
  bulletText: {
    fontSize: 18,
    color: "#334155",
    lineHeight: 1.5,
    flex: 1,
  },
  notesSection: {
    position: "absolute",
    bottom: 50,
    left: 60,
    right: 60,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 12,
  },
  notesText: {
    fontSize: 10,
    color: "#64748b",
    fontStyle: "italic",
  },
});

type SlidesPDFProps = {
  slides: Slide[];
  title?: string;
};

function SlidesPDFDocument({ slides, title }: SlidesPDFProps) {
  return (
    <Document title={title ?? "Presentation"}>
      {slides.map((slide, index) => (
        <Page key={index} orientation="landscape" size="A4" style={styles.page}>
          <Text style={styles.title}>{slide.title}</Text>

          {slide.bullets && slide.bullets.length > 0 && (
            <View style={styles.bulletContainer}>
              {slide.bullets.map((bullet, bulletIndex) => (
                <View key={bulletIndex} style={styles.bulletItem}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.bulletText}>{bullet}</Text>
                </View>
              ))}
            </View>
          )}

          {slide.notes && (
            <View style={styles.notesSection}>
              <Text style={styles.notesText}>{slide.notes}</Text>
            </View>
          )}

          <Text style={styles.slideNumber}>
            {index + 1} / {slides.length}
          </Text>
        </Page>
      ))}
    </Document>
  );
}

export async function generateSlidesPDF(
  slides: Slide[],
  title?: string
): Promise<Blob> {
  const doc = <SlidesPDFDocument slides={slides} title={title} />;
  const blob = await pdf(doc).toBlob();
  return blob;
}

export function downloadSlidesPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
