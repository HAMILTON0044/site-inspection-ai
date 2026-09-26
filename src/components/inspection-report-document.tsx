import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { InspectionAnalysis } from "@/lib/schemas";
import { categoryLabel, riskLabel, type Locale } from "@/lib/i18n";

type Finding = InspectionAnalysis["findings"][number];

export type ReportPhoto = {
  name: string;
  imageData: string;
  detectionSummary: string[];
};

export type InspectionReportData = {
  locale: Locale;
  reportNumber: string;
  projectName: string;
  inspectorName: string;
  generatedAt: string;
  note: string;
  analysis: InspectionAnalysis;
  approvedFindings: Finding[];
  rejectedFindingCount: number;
  photos: ReportPhoto[];
};

const riskColors: Record<Finding["risk_level"], string> = {
  LOW: "#047857",
  MEDIUM: "#b45309",
  HIGH: "#c2410c",
  CRITICAL: "#b91c1c",
  UNCONFIRMED: "#475569",
};

export function registerInspectionReportFonts(basePath: string) {
  Font.register({
    family: "NotoSansSC",
    fonts: [
      {
        src: `${basePath}/noto-sans-sc-400.woff`,
        fontWeight: 400,
      },
      {
        src: `${basePath}/noto-sans-sc-700.woff`,
        fontWeight: 700,
      },
    ],
  });
  Font.registerHyphenationCallback((word) =>
    /[\u3400-\u9fff]/u.test(word) ? Array.from(word) : [word],
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 58,
    paddingRight: 38,
    paddingBottom: 48,
    paddingLeft: 38,
    fontFamily: "NotoSansSC",
    fontSize: 9,
    lineHeight: 1.55,
    color: "#1e293b",
    backgroundColor: "#ffffff",
  },
  pageHeader: {
    position: "absolute",
    top: 24,
    left: 38,
    right: 38,
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    zIndex: 100,
  },
  brand: {
    fontSize: 9,
    fontWeight: 700,
    color: "#0f172a",
    letterSpacing: 1.2,
  },
  confidential: {
    fontSize: 7,
    color: "#64748b",
  },
  pageFooter: {
    position: "absolute",
    bottom: 26,
    left: 38,
    right: 38,
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    color: "#94a3b8",
    fontSize: 7,
  },
  hero: {
    padding: 24,
    borderRadius: 10,
    backgroundColor: "#0b1728",
  },
  heroKicker: {
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 1.5,
    color: "#fbbf24",
  },
  heroTitle: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: 700,
    lineHeight: 1.25,
    color: "#ffffff",
  },
  heroSubtitle: {
    marginTop: 8,
    maxWidth: 360,
    fontSize: 9,
    color: "#cbd5e1",
  },
  metadataGrid: {
    marginTop: 14,
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
  },
  metadataItem: {
    width: "50%",
    padding: 11,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: "#e2e8f0",
  },
  metadataLabel: {
    fontSize: 7,
    color: "#64748b",
  },
  metadataValue: {
    marginTop: 3,
    fontSize: 9,
    fontWeight: 700,
    color: "#0f172a",
  },
  section: {
    marginTop: 18,
  },
  sectionHeading: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 9,
  },
  sectionAccent: {
    width: 4,
    height: 16,
    marginRight: 8,
    borderRadius: 2,
    backgroundColor: "#f59e0b",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#0f172a",
  },
  summaryBox: {
    padding: 13,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  summaryLabel: {
    marginTop: 8,
    fontSize: 7,
    color: "#64748b",
  },
  summaryLabelFirst: {
    fontSize: 7,
    color: "#64748b",
  },
  summaryText: {
    marginTop: 3,
    fontSize: 9,
    color: "#334155",
  },
  reviewStrip: {
    marginTop: 10,
    display: "flex",
    flexDirection: "row",
    gap: 8,
  },
  reviewCard: {
    flexGrow: 1,
    padding: 9,
    borderRadius: 7,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  reviewNumber: {
    fontSize: 15,
    fontWeight: 700,
    color: "#0f172a",
  },
  reviewLabel: {
    marginTop: 2,
    fontSize: 7,
    color: "#64748b",
  },
  findingCard: {
    marginBottom: 11,
    padding: 13,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dbe3ec",
    backgroundColor: "#ffffff",
  },
  findingHeader: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  findingIndex: {
    fontSize: 7,
    fontWeight: 700,
    color: "#2563eb",
  },
  findingTitle: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: 700,
    color: "#0f172a",
  },
  riskBadge: {
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRadius: 8,
    color: "#ffffff",
    fontSize: 7,
    fontWeight: 700,
  },
  findingRow: {
    marginTop: 9,
  },
  findingLabel: {
    fontSize: 7,
    fontWeight: 700,
    color: "#64748b",
  },
  findingText: {
    marginTop: 2,
    fontSize: 8.5,
    color: "#334155",
  },
  actionBox: {
    marginTop: 9,
    padding: 9,
    borderRadius: 6,
    backgroundColor: "#eff6ff",
  },
  actionLabel: {
    fontSize: 7,
    fontWeight: 700,
    color: "#1d4ed8",
  },
  actionText: {
    marginTop: 2,
    fontSize: 8.5,
    color: "#1e3a8a",
  },
  emptyState: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    color: "#047857",
  },
  photoCard: {
    marginBottom: 14,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  photoName: {
    marginBottom: 7,
    fontSize: 8,
    fontWeight: 700,
    color: "#0f172a",
  },
  photo: {
    width: "100%",
    height: 260,
    objectFit: "contain",
    backgroundColor: "#0f172a",
  },
  detectionText: {
    marginTop: 7,
    fontSize: 7,
    color: "#475569",
  },
  signoff: {
    marginTop: 18,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  signoffTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: "#0f172a",
  },
  signoffRow: {
    marginTop: 24,
    display: "flex",
    flexDirection: "row",
    gap: 24,
  },
  signature: {
    flexGrow: 1,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#94a3b8",
    fontSize: 7,
    color: "#64748b",
  },
  disclaimer: {
    marginTop: 10,
    fontSize: 7,
    lineHeight: 1.5,
    color: "#64748b",
  },
});

function PageChrome({
  pageNumber,
  totalPages,
  locale,
}: {
  pageNumber: number;
  totalPages: number;
  locale: Locale;
}) {
  const zh = locale === "zh";
  return (
    <>
      <View style={styles.pageHeader} fixed>
        <Text style={styles.brand}>SITE INSPECTION AI</Text>
        <Text style={styles.confidential}>{zh ? "施工现场巡检报告 · 内部使用" : "SITE INSPECTION REPORT · INTERNAL USE"}</Text>
      </View>
      <View style={styles.pageFooter} fixed>
        <Text>{zh ? "AI 辅助生成 · 已完成人工审核" : "AI ASSISTED · HUMAN REVIEWED"}</Text>
        <Text>{zh ? `第 ${pageNumber} 页 / 共 ${totalPages} 页` : `PAGE ${pageNumber} OF ${totalPages}`}</Text>
      </View>
    </>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionAccent} />
      <Text style={styles.sectionTitle}>{children}</Text>
    </View>
  );
}

function FindingCard({ finding, index, locale }: { finding: Finding; index: number; locale: Locale }) {
  const zh = locale === "zh";
  return (
    <View style={styles.findingCard} wrap={false}>
      <View style={styles.findingHeader}>
        <View style={{ flexGrow: 1 }}>
          <Text style={styles.findingIndex}>
            {zh ? "问题" : "FINDING"} {String(index + 1).padStart(2, "0")} · {categoryLabel(locale, finding.category)}
          </Text>
          <Text style={styles.findingTitle}>{finding.title}</Text>
        </View>
        <Text
          style={[
            styles.riskBadge,
            { backgroundColor: riskColors[finding.risk_level] },
          ]}
        >
          {riskLabel(locale, finding.risk_level)}
        </Text>
      </View>
      <View style={styles.findingRow}>
        <Text style={styles.findingLabel}>{zh ? "问题描述" : "DESCRIPTION"}</Text>
        <Text style={styles.findingText}>{finding.description}</Text>
      </View>
      <View style={styles.findingRow}>
        <Text style={styles.findingLabel}>{zh ? "可见证据" : "VISIBLE EVIDENCE"}</Text>
        <Text style={styles.findingText}>{finding.visible_evidence}</Text>
      </View>
      <View style={styles.findingRow}>
        <Text style={styles.findingLabel}>{zh ? "证据来源" : "EVIDENCE SOURCE"}</Text>
        <Text style={styles.findingText}>
          {finding.evidence_photos.length > 0
            ? finding.evidence_photos.join(zh ? "、" : ", ")
            : zh ? "巡检员文字备注" : "Inspector note"}
        </Text>
      </View>
      <View style={styles.actionBox}>
        <Text style={styles.actionLabel}>{zh ? "建议整改措施" : "RECOMMENDED CORRECTIVE ACTION"}</Text>
        <Text style={styles.actionText}>{finding.corrective_action}</Text>
      </View>
      {finding.uncertainty.length > 0 && (
        <View style={styles.findingRow}>
          <Text style={styles.findingLabel}>{zh ? "仍需现场确认" : "REQUIRES SITE CONFIRMATION"}</Text>
          <Text style={styles.findingText}>
            {finding.uncertainty.join(zh ? "；" : "; ")}
          </Text>
        </View>
      )}
    </View>
  );
}

function Signoff({ locale }: { locale: Locale }) {
  const zh = locale === "zh";
  return (
    <View style={styles.signoff} wrap={false}>
      <Text style={styles.signoffTitle}>{zh ? "审核与确认" : "REVIEW & CONFIRMATION"}</Text>
      <View style={styles.signoffRow}>
        <Text style={styles.signature}>{zh ? "巡检员签名 / 日期" : "Inspector signature / Date"}</Text>
        <Text style={styles.signature}>{zh ? "Manager 复核 / 日期" : "Manager review / Date"}</Text>
      </View>
      <Text style={styles.disclaimer}>
        {zh ? "说明：自动视觉检测和 AI 内容仅用于辅助整理巡检证据，不能替代持证安全人员的现场判断。最终问题、风险等级和整改措施应由授权人员确认。" : "Notice: Automated vision detection and AI content only assist with organising inspection evidence. They do not replace an authorised safety professional's on-site judgement. Final findings, risk levels and corrective actions must be confirmed by authorised personnel."}
      </Text>
    </View>
  );
}

export function InspectionReportDocument({
  data,
}: {
  data: InspectionReportData;
}) {
  const totalPages =
    1 + data.approvedFindings.length + data.photos.length;
  const zh = data.locale === "zh";

  return (
    <Document
      title={`${data.projectName} - ${zh ? "施工现场巡检报告" : "Site Inspection Report"}`}
      author="Site Inspection AI"
      subject={zh ? "人工审核后的施工现场巡检记录" : "Human-reviewed site inspection record"}
      keywords="site inspection, safety, construction"
      language={zh ? "zh-CN" : "en-SG"}
    >
      <Page size="A4" style={styles.page} wrap>
        <PageChrome pageNumber={1} totalPages={totalPages} locale={data.locale} />
        <View style={styles.hero}>
          <Text style={styles.heroKicker}>FORMAL INSPECTION REPORT</Text>
          <Text style={styles.heroTitle}>{zh ? "施工现场巡检报告" : "SITE INSPECTION REPORT"}</Text>
          <Text style={styles.heroSubtitle}>
            {zh ? "本报告汇总现场照片、巡检备注、自动检测证据以及经人工确认的问题和整改建议。" : "This report brings together site photos, inspection notes, automated evidence and human-confirmed findings and actions."}
          </Text>
        </View>

        <View style={styles.metadataGrid}>
          <View style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>{zh ? "报告编号" : "REPORT NUMBER"}</Text>
            <Text style={styles.metadataValue}>{data.reportNumber}</Text>
          </View>
          <View style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>{zh ? "所属项目" : "PROJECT"}</Text>
            <Text style={styles.metadataValue}>{data.projectName}</Text>
          </View>
          <View style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>{zh ? "巡检位置" : "LOCATION"}</Text>
            <Text style={styles.metadataValue}>{data.analysis.location}</Text>
          </View>
          <View style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>{zh ? "巡检员" : "INSPECTOR"}</Text>
            <Text style={styles.metadataValue}>{data.inspectorName}</Text>
          </View>
          <View style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>{zh ? "报告生成时间" : "GENERATED AT"}</Text>
            <Text style={styles.metadataValue}>{data.generatedAt}</Text>
          </View>
          <View style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>{zh ? "审核状态" : "REVIEW STATUS"}</Text>
            <Text style={styles.metadataValue}>{zh ? "人工审核完成" : "Human review complete"}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeading>{zh ? "巡检摘要" : "INSPECTION SUMMARY"}</SectionHeading>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabelFirst}>{zh ? "AI 分析摘要" : "AI ANALYSIS SUMMARY"}</Text>
            <Text style={styles.summaryText}>{data.analysis.summary}</Text>
            <Text style={styles.summaryLabel}>{zh ? "巡检员原始备注" : "ORIGINAL INSPECTOR NOTE"}</Text>
            <Text style={styles.summaryText}>{data.note}</Text>
          </View>
          <View style={styles.reviewStrip}>
            <View style={styles.reviewCard}>
              <Text style={styles.reviewNumber}>{data.photos.length}</Text>
              <Text style={styles.reviewLabel}>{zh ? "证据照片" : "Evidence photos"}</Text>
            </View>
            <View style={styles.reviewCard}>
              <Text style={styles.reviewNumber}>
                {data.approvedFindings.length}
              </Text>
              <Text style={styles.reviewLabel}>{zh ? "已批准问题" : "Approved findings"}</Text>
            </View>
            <View style={styles.reviewCard}>
              <Text style={styles.reviewNumber}>
                {data.rejectedFindingCount}
              </Text>
              <Text style={styles.reviewLabel}>{zh ? "已驳回草稿" : "Rejected drafts"}</Text>
            </View>
          </View>
        </View>

        {data.approvedFindings.length === 0 && (
          <View style={styles.section}>
            <SectionHeading>{zh ? "经确认的问题与整改措施" : "CONFIRMED FINDINGS & ACTIONS"}</SectionHeading>
            <Text style={styles.emptyState}>
              {zh ? "本次巡检没有经人工批准的问题。该结论仅代表当前记录范围，不能替代完整的现场安全检查。" : "No findings were approved during this inspection. This only reflects the scope of this record and does not replace a complete on-site safety inspection."}
            </Text>
          </View>
        )}

        {data.approvedFindings.length === 0 && data.photos.length === 0 && (
          <Signoff locale={data.locale} />
        )}
      </Page>

      {data.approvedFindings.map((finding, index) => (
        <Page key={finding.id} size="A4" style={styles.page} wrap={false}>
          <PageChrome
            pageNumber={index + 2}
            totalPages={totalPages}
            locale={data.locale}
          />
          <View style={{ height: 28 }} />
          <View style={styles.section}>
            <SectionHeading>
              {zh ? "经确认的问题与整改措施" : "CONFIRMED FINDINGS & ACTIONS"} · {index + 1}/
              {data.approvedFindings.length}
            </SectionHeading>
            <FindingCard finding={finding} index={index} locale={data.locale} />
          </View>
          {index === data.approvedFindings.length - 1 &&
            data.photos.length === 0 && <Signoff locale={data.locale} />}
        </Page>
      ))}

      {data.photos.map((photo, index) => (
        <Page
          key={`${photo.name}-${index}`}
          size="A4"
          style={styles.page}
          wrap={false}
        >
          <PageChrome
            pageNumber={index + data.approvedFindings.length + 2}
            totalPages={totalPages}
            locale={data.locale}
          />
          <View style={{ height: 28 }} />
          <View style={styles.section}>
            <SectionHeading>
              {zh ? "现场照片与自动检测证据" : "SITE PHOTOS & AUTOMATED EVIDENCE"} · {index + 1}/{data.photos.length}
            </SectionHeading>
            <View style={styles.photoCard} wrap={false}>
              <Text style={styles.photoName}>
                {zh ? "照片" : "PHOTO"} {index + 1} · {photo.name}
              </Text>
              {/* react-pdf Image is a PDF primitive and has no HTML alt prop. */}
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={photo.imageData} style={styles.photo} />
              <Text style={styles.detectionText}>
                {photo.detectionSummary.length > 0
                  ? `${zh ? "保留的自动检测" : "Retained automated detections"}: ${photo.detectionSummary.join(zh ? "、" : ", ")}`
                  : zh ? "当前照片没有保留的自动检测结果，请以人工现场判断为准。" : "No automated detections were retained for this photo. Rely on human on-site judgement."}
              </Text>
            </View>
          </View>
          {index === data.photos.length - 1 && <Signoff locale={data.locale} />}
        </Page>
      ))}
    </Document>
  );
}
