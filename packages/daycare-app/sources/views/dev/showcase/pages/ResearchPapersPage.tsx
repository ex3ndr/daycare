import { Ionicons } from "@expo/vector-icons";
import * as React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

// --- Types ---

type ReadingStatus = "to_read" | "reading" | "read" | "cited";
type Field = "Machine Learning" | "NLP" | "Computer Vision" | "Robotics" | "Systems" | "HCI";

type Paper = {
    id: string;
    title: string;
    authors: string[];
    year: number;
    venue: string;
    venueType: "conference" | "journal";
    field: Field;
    status: ReadingStatus;
    relevance: number; // 1-5
    abstract: string;
    keyFindings: string[];
    bibtex: string;
    relatedPaperIds: string[];
};

// --- Field colors ---

const FIELD_COLORS: Record<Field, string> = {
    "Machine Learning": "#7c3aed",
    NLP: "#0891b2",
    "Computer Vision": "#059669",
    Robotics: "#dc2626",
    Systems: "#ea580c",
    HCI: "#d946ef"
};

const STATUS_TABS: { key: ReadingStatus; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "to_read", label: "To Read", icon: "bookmark-outline" },
    { key: "reading", label: "Reading", icon: "glasses-outline" },
    { key: "read", label: "Read", icon: "checkmark-circle-outline" },
    { key: "cited", label: "Cited", icon: "link-outline" }
];

// --- Mock data ---

const PAPERS: Paper[] = [
    {
        id: "p1",
        title: "Attention Is All You Need",
        authors: ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar", "Jakob Uszkoreit", "Llion Jones", "Aidan N. Gomez"],
        year: 2017,
        venue: "NeurIPS",
        venueType: "conference",
        field: "NLP",
        status: "cited",
        relevance: 5,
        abstract:
            "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.",
        keyFindings: [
            "Self-attention can replace recurrence entirely for sequence modeling",
            "Multi-head attention allows the model to attend to different representation subspaces",
            "Positional encoding enables the model to leverage sequence order without recurrence"
        ],
        bibtex: `@inproceedings{vaswani2017attention,
  title={Attention is all you need},
  author={Vaswani, Ashish and others},
  booktitle={NeurIPS},
  year={2017}
}`,
        relatedPaperIds: ["p3", "p5"]
    },
    {
        id: "p2",
        title: "Denoising Diffusion Probabilistic Models",
        authors: ["Jonathan Ho", "Ajay Jain", "Pieter Abbeel"],
        year: 2020,
        venue: "NeurIPS",
        venueType: "conference",
        field: "Machine Learning",
        status: "read",
        relevance: 5,
        abstract:
            "We present high quality image synthesis results using diffusion probabilistic models, a class of latent variable models inspired by considerations from nonequilibrium thermodynamics. Our best results are obtained by training on a weighted variational bound designed according to a novel connection between diffusion probabilistic models and denoising score matching.",
        keyFindings: [
            "Diffusion models can generate high-quality images competitive with GANs",
            "A simplified training objective based on denoising score matching is effective",
            "Progressive generation from noise to data enables stable training"
        ],
        bibtex: `@inproceedings{ho2020denoising,
  title={Denoising diffusion probabilistic models},
  author={Ho, Jonathan and Jain, Ajay and Abbeel, Pieter},
  booktitle={NeurIPS},
  year={2020}
}`,
        relatedPaperIds: ["p4"]
    },
    {
        id: "p3",
        title: "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding",
        authors: ["Jacob Devlin", "Ming-Wei Chang", "Kenton Lee", "Kristina Toutanova"],
        year: 2019,
        venue: "NAACL",
        venueType: "conference",
        field: "NLP",
        status: "cited",
        relevance: 5,
        abstract:
            "We introduce a new language representation model called BERT, which stands for Bidirectional Encoder Representations from Transformers. Unlike recent language representation models, BERT is designed to pre-train deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context in all layers.",
        keyFindings: [
            "Masked language modeling enables true bidirectional pre-training",
            "Next sentence prediction improves performance on pair-level tasks",
            "Fine-tuning a single pre-trained model works across diverse NLP tasks"
        ],
        bibtex: `@inproceedings{devlin2019bert,
  title={BERT: Pre-training of deep bidirectional transformers},
  author={Devlin, Jacob and others},
  booktitle={NAACL},
  year={2019}
}`,
        relatedPaperIds: ["p1", "p5"]
    },
    {
        id: "p4",
        title: "High-Resolution Image Synthesis with Latent Diffusion Models",
        authors: ["Robin Rombach", "Andreas Blattmann", "Dominik Lorenz", "Patrick Esser", "Bjorn Ommer"],
        year: 2022,
        venue: "CVPR",
        venueType: "conference",
        field: "Computer Vision",
        status: "reading",
        relevance: 4,
        abstract:
            "By decomposing the image formation process into a sequential application of denoising autoencoders, diffusion models achieve state-of-the-art synthesis results. We apply diffusion models in the latent space of powerful pretrained autoencoders, enabling training on limited computational resources while retaining quality.",
        keyFindings: [
            "Operating in latent space dramatically reduces computational cost",
            "Cross-attention mechanism enables flexible conditioning (text, layout, etc.)",
            "Achieves competitive FID scores with much lower training compute"
        ],
        bibtex: `@inproceedings{rombach2022high,
  title={High-resolution image synthesis with latent diffusion models},
  author={Rombach, Robin and others},
  booktitle={CVPR},
  year={2022}
}`,
        relatedPaperIds: ["p2"]
    },
    {
        id: "p5",
        title: "Language Models are Few-Shot Learners",
        authors: ["Tom B. Brown", "Benjamin Mann", "Nick Ryder", "Melanie Subbiah", "Jared Kaplan"],
        year: 2020,
        venue: "NeurIPS",
        venueType: "conference",
        field: "NLP",
        status: "read",
        relevance: 5,
        abstract:
            "Recent work has demonstrated substantial gains on many NLP tasks and benchmarks by pre-training on a large corpus of text followed by fine-tuning on a specific task. We show that scaling up language models greatly improves task-agnostic, few-shot performance, sometimes even reaching competitiveness with prior state-of-the-art fine-tuning approaches.",
        keyFindings: [
            "Scaling model size consistently improves few-shot learning ability",
            "In-context learning enables task performance without gradient updates",
            "GPT-3 demonstrates broad capabilities across many NLP benchmarks"
        ],
        bibtex: `@inproceedings{brown2020language,
  title={Language models are few-shot learners},
  author={Brown, Tom B. and others},
  booktitle={NeurIPS},
  year={2020}
}`,
        relatedPaperIds: ["p1", "p3"]
    },
    {
        id: "p6",
        title: "MuZero: Mastering Atari, Go, Chess and Shogi by Planning with a Learned Model",
        authors: ["Julian Schrittwieser", "Ioannis Antonoglou", "Thomas Hubert", "Karen Simonyan", "David Silver"],
        year: 2020,
        venue: "Nature",
        venueType: "journal",
        field: "Machine Learning",
        status: "to_read",
        relevance: 4,
        abstract:
            "Constructing agents with planning capabilities has long been one of the main challenges in the pursuit of artificial intelligence. Here we present the MuZero algorithm which, by combining a tree-based search with a learned model, achieves superhuman performance in a range of challenging and visually complex domains.",
        keyFindings: [
            "Learned dynamics model eliminates need for perfect environment simulator",
            "Combines MCTS planning with model-free value and policy predictions",
            "Achieves superhuman performance across board games and Atari"
        ],
        bibtex: `@article{schrittwieser2020mastering,
  title={Mastering Atari, Go, chess and shogi by planning with a learned model},
  author={Schrittwieser, Julian and others},
  journal={Nature},
  year={2020}
}`,
        relatedPaperIds: ["p8"]
    },
    {
        id: "p7",
        title: "NeRF: Representing Scenes as Neural Radiance Fields for View Synthesis",
        authors: ["Ben Mildenhall", "Pratul P. Srinivasan", "Matthew Tancik", "Jonathan T. Barron", "Ravi Ramamoorthi"],
        year: 2020,
        venue: "ECCV",
        venueType: "conference",
        field: "Computer Vision",
        status: "to_read",
        relevance: 3,
        abstract:
            "We present a method that achieves state-of-the-art results for synthesizing novel views of complex scenes by optimizing an underlying continuous volumetric scene function using a sparse set of input views. Our algorithm represents a scene using a fully-connected deep network whose input is a single continuous 5D coordinate.",
        keyFindings: [
            "Continuous 5D neural representation enables photorealistic novel view synthesis",
            "Positional encoding enables high-frequency detail capture",
            "Hierarchical sampling strategy improves rendering efficiency"
        ],
        bibtex: `@inproceedings{mildenhall2020nerf,
  title={NeRF: Representing scenes as neural radiance fields},
  author={Mildenhall, Ben and others},
  booktitle={ECCV},
  year={2020}
}`,
        relatedPaperIds: ["p4"]
    },
    {
        id: "p8",
        title: "RT-2: Vision-Language-Action Models Transfer Web Knowledge to Robotic Control",
        authors: ["Anthony Brohan", "Noah Brown", "Justice Carbajal", "Yevgen Chebotar", "Karol Hausman"],
        year: 2023,
        venue: "CoRL",
        venueType: "conference",
        field: "Robotics",
        status: "reading",
        relevance: 4,
        abstract:
            "We study how vision-language models trained on Internet-scale data can be incorporated directly into end-to-end robotic control to boost generalization and enable emergent semantic reasoning. We introduce RT-2, a class of action models that are trained on both web and robotics data and can act as robotic policies.",
        keyFindings: [
            "VLMs can directly output robotic actions when co-fine-tuned on robot data",
            "Web-scale pre-training transfers semantic understanding to physical manipulation",
            "Emergent capabilities include chain-of-thought reasoning for robot tasks"
        ],
        bibtex: `@inproceedings{brohan2023rt2,
  title={RT-2: Vision-language-action models},
  author={Brohan, Anthony and others},
  booktitle={CoRL},
  year={2023}
}`,
        relatedPaperIds: ["p6"]
    },
    {
        id: "p9",
        title: "Raft: In Search of an Understandable Consensus Algorithm",
        authors: ["Diego Ongaro", "John Ousterhout"],
        year: 2014,
        venue: "USENIX ATC",
        venueType: "conference",
        field: "Systems",
        status: "read",
        relevance: 3,
        abstract:
            "Raft is a consensus algorithm for managing a replicated log. It produces a result equivalent to multi-Paxos, and it is as efficient as Paxos, but its structure is different from Paxos; this makes Raft more understandable than Paxos and also provides a better foundation for building practical systems.",
        keyFindings: [
            "Leader election, log replication, and safety can be decomposed into understandable subproblems",
            "Strong leader model simplifies reasoning about consistency",
            "Understandability is a valid and important design goal for distributed algorithms"
        ],
        bibtex: `@inproceedings{ongaro2014raft,
  title={In search of an understandable consensus algorithm},
  author={Ongaro, Diego and Ousterhout, John},
  booktitle={USENIX ATC},
  year={2014}
}`,
        relatedPaperIds: []
    },
    {
        id: "p10",
        title: "Interactive Machine Teaching with a Collaborative Interface",
        authors: ["Simone Stumpf", "Vidya Rajaram", "Lida Li", "Margaret Burnett"],
        year: 2023,
        venue: "CHI",
        venueType: "conference",
        field: "HCI",
        status: "to_read",
        relevance: 3,
        abstract:
            "We present a collaborative interface for interactive machine teaching that allows domain experts to teach machine learning models through natural interaction paradigms. The system supports iterative refinement through example-based corrections, feature highlighting, and natural language explanations.",
        keyFindings: [
            "Non-expert users can effectively teach ML models through collaborative interfaces",
            "Combining multiple teaching modalities improves model accuracy",
            "Interactive feedback loops reduce the number of examples needed for training"
        ],
        bibtex: `@inproceedings{stumpf2023interactive,
  title={Interactive machine teaching with a collaborative interface},
  author={Stumpf, Simone and others},
  booktitle={CHI},
  year={2023}
}`,
        relatedPaperIds: []
    }
];

// --- Helpers ---

function truncateAuthors(authors: string[], max: number): string {
    if (authors.length <= max) return authors.join(", ");
    return `${authors.slice(0, max).join(", ")} et al. (+${authors.length - max})`;
}

function paperById(id: string): Paper | undefined {
    return PAPERS.find((p) => p.id === id);
}

// --- Relevance Stars ---

function RelevanceStars({ rating, size }: { rating: number; size: number }) {
    const { theme } = useUnistyles();
    return (
        <View style={{ flexDirection: "row", gap: 2 }}>
            {[1, 2, 3, 4, 5].map((i) => (
                <Ionicons
                    key={i}
                    name={i <= rating ? "star" : "star-outline"}
                    size={size}
                    color={i <= rating ? "#f59e0b" : theme.colors.outlineVariant}
                />
            ))}
        </View>
    );
}

// --- Venue Chip ---

function VenueChip({ venue, venueType }: { venue: string; venueType: "conference" | "journal" }) {
    const { theme } = useUnistyles();
    const isJournal = venueType === "journal";
    return (
        <View
            style={[
                styles.venueChip,
                {
                    backgroundColor: isJournal ? `${theme.colors.primary}15` : `${theme.colors.tertiary}15`,
                    borderColor: isJournal ? `${theme.colors.primary}30` : `${theme.colors.tertiary}30`
                }
            ]}
        >
            <Ionicons
                name={isJournal ? "journal-outline" : "people-outline"}
                size={10}
                color={isJournal ? theme.colors.primary : theme.colors.tertiary}
            />
            <Text style={[styles.venueChipText, { color: isJournal ? theme.colors.primary : theme.colors.tertiary }]}>
                {venue}
            </Text>
        </View>
    );
}

// --- Year Badge ---

function YearBadge({ year }: { year: number }) {
    const { theme } = useUnistyles();
    return (
        <View style={[styles.yearBadge, { backgroundColor: theme.colors.surfaceContainerHighest }]}>
            <Text style={[styles.yearBadgeText, { color: theme.colors.onSurfaceVariant }]}>{year}</Text>
        </View>
    );
}

// --- Field Accent Bar ---

function FieldAccentHeader({ field, count }: { field: Field; count: number }) {
    const { theme } = useUnistyles();
    const color = FIELD_COLORS[field];
    return (
        <View style={styles.fieldHeader}>
            <View style={[styles.fieldAccentBar, { backgroundColor: color }]} />
            <Text style={[styles.fieldHeaderText, { color: theme.colors.onSurface }]}>{field}</Text>
            <View style={[styles.fieldCountBadge, { backgroundColor: `${color}20` }]}>
                <Text style={[styles.fieldCountText, { color }]}>{count}</Text>
            </View>
        </View>
    );
}

// --- Segmented Control ---

function SegmentedControl({
    activeTab,
    onSelect,
    counts
}: {
    activeTab: ReadingStatus;
    onSelect: (tab: ReadingStatus) => void;
    counts: Record<ReadingStatus, number>;
}) {
    const { theme } = useUnistyles();
    return (
        <View style={[styles.segmentedRow, { backgroundColor: theme.colors.surfaceContainer }]}>
            {STATUS_TABS.map(({ key, label, icon }) => {
                const isActive = activeTab === key;
                return (
                    <Pressable
                        key={key}
                        onPress={() => onSelect(key)}
                        style={[
                            styles.segmentItem,
                            {
                                backgroundColor: isActive ? theme.colors.primary : "transparent",
                                borderColor: isActive ? theme.colors.primary : "transparent"
                            }
                        ]}
                    >
                        <Ionicons
                            name={icon}
                            size={14}
                            color={isActive ? theme.colors.onPrimary : theme.colors.onSurfaceVariant}
                        />
                        <Text
                            style={[
                                styles.segmentLabel,
                                { color: isActive ? theme.colors.onPrimary : theme.colors.onSurfaceVariant }
                            ]}
                        >
                            {label}
                        </Text>
                        <View
                            style={[
                                styles.segmentCount,
                                {
                                    backgroundColor: isActive
                                        ? `${theme.colors.onPrimary}30`
                                        : `${theme.colors.outlineVariant}40`
                                }
                            ]}
                        >
                            <Text
                                style={[
                                    styles.segmentCountText,
                                    { color: isActive ? theme.colors.onPrimary : theme.colors.onSurfaceVariant }
                                ]}
                            >
                                {counts[key]}
                            </Text>
                        </View>
                    </Pressable>
                );
            })}
        </View>
    );
}

// --- Paper Card ---

function PaperCard({ paper, isExpanded, onToggle }: { paper: Paper; isExpanded: boolean; onToggle: () => void }) {
    const { theme } = useUnistyles();
    const fieldColor = FIELD_COLORS[paper.field];
    const relatedPapers = paper.relatedPaperIds.map(paperById).filter(Boolean) as Paper[];

    return (
        <Pressable onPress={onToggle}>
            <View style={[styles.paperCard, { backgroundColor: theme.colors.surfaceContainer }]}>
                {/* Field color accent stripe on the left */}
                <View style={[styles.paperAccentStripe, { backgroundColor: fieldColor }]} />

                <View style={styles.paperContent}>
                    {/* Top row: year badge + venue chip + relevance */}
                    <View style={styles.paperTopRow}>
                        <YearBadge year={paper.year} />
                        <VenueChip venue={paper.venue} venueType={paper.venueType} />
                        <View style={{ flex: 1 }} />
                        <RelevanceStars rating={paper.relevance} size={12} />
                    </View>

                    {/* Title */}
                    <Text
                        style={[styles.paperTitle, { color: theme.colors.onSurface }]}
                        numberOfLines={isExpanded ? undefined : 2}
                    >
                        {paper.title}
                    </Text>

                    {/* Authors */}
                    <Text style={[styles.paperAuthors, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                        {truncateAuthors(paper.authors, 3)}
                    </Text>

                    {/* Expand indicator */}
                    <View style={styles.expandRow}>
                        <Ionicons
                            name={isExpanded ? "chevron-up" : "chevron-down"}
                            size={16}
                            color={theme.colors.onSurfaceVariant}
                        />
                        <Text style={[styles.expandHint, { color: theme.colors.onSurfaceVariant }]}>
                            {isExpanded ? "Collapse" : "Show details"}
                        </Text>
                    </View>

                    {/* Expanded detail panel */}
                    {isExpanded && (
                        <View style={styles.detailPanel}>
                            {/* Abstract */}
                            <View style={styles.detailSection}>
                                <View style={styles.detailSectionHeader}>
                                    <Ionicons name="document-text-outline" size={14} color={theme.colors.primary} />
                                    <Text style={[styles.detailSectionTitle, { color: theme.colors.primary }]}>
                                        Abstract
                                    </Text>
                                </View>
                                <Text style={[styles.abstractText, { color: theme.colors.onSurface }]}>
                                    {paper.abstract}
                                </Text>
                            </View>

                            {/* Key Findings */}
                            <View style={styles.detailSection}>
                                <View style={styles.detailSectionHeader}>
                                    <Ionicons name="bulb-outline" size={14} color="#f59e0b" />
                                    <Text style={[styles.detailSectionTitle, { color: "#f59e0b" }]}>Key Findings</Text>
                                </View>
                                {paper.keyFindings.map((finding) => (
                                    <View key={finding} style={styles.findingRow}>
                                        <View style={[styles.findingBullet, { backgroundColor: fieldColor }]} />
                                        <Text style={[styles.findingText, { color: theme.colors.onSurface }]}>
                                            {finding}
                                        </Text>
                                    </View>
                                ))}
                            </View>

                            {/* BibTeX */}
                            <View style={styles.detailSection}>
                                <View style={styles.detailSectionHeader}>
                                    <Ionicons name="code-slash-outline" size={14} color={theme.colors.tertiary} />
                                    <Text style={[styles.detailSectionTitle, { color: theme.colors.tertiary }]}>
                                        BibTeX
                                    </Text>
                                </View>
                                <View
                                    style={[
                                        styles.bibtexBlock,
                                        {
                                            backgroundColor: theme.colors.surfaceContainerHighest,
                                            borderColor: theme.colors.outlineVariant
                                        }
                                    ]}
                                >
                                    <Text style={[styles.bibtexText, { color: theme.colors.onSurface }]}>
                                        {paper.bibtex}
                                    </Text>
                                </View>
                            </View>

                            {/* Related Papers */}
                            {relatedPapers.length > 0 && (
                                <View style={styles.detailSection}>
                                    <View style={styles.detailSectionHeader}>
                                        <Ionicons name="git-branch-outline" size={14} color={theme.colors.secondary} />
                                        <Text style={[styles.detailSectionTitle, { color: theme.colors.secondary }]}>
                                            Related Papers
                                        </Text>
                                    </View>
                                    {relatedPapers.map((rp) => (
                                        <View
                                            key={rp.id}
                                            style={[
                                                styles.relatedPaperRow,
                                                { borderColor: theme.colors.outlineVariant }
                                            ]}
                                        >
                                            <View
                                                style={[styles.relatedDot, { backgroundColor: FIELD_COLORS[rp.field] }]}
                                            />
                                            <View style={styles.relatedContent}>
                                                <Text
                                                    style={[styles.relatedTitle, { color: theme.colors.onSurface }]}
                                                    numberOfLines={1}
                                                >
                                                    {rp.title}
                                                </Text>
                                                <Text
                                                    style={[
                                                        styles.relatedMeta,
                                                        { color: theme.colors.onSurfaceVariant }
                                                    ]}
                                                >
                                                    {rp.authors[0]} et al., {rp.year} - {rp.venue}
                                                </Text>
                                            </View>
                                            <Ionicons
                                                name="open-outline"
                                                size={14}
                                                color={theme.colors.onSurfaceVariant}
                                            />
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    )}
                </View>
            </View>
        </Pressable>
    );
}

// --- Stats Bar ---

function StatsBar({ papers }: { papers: Paper[] }) {
    const { theme } = useUnistyles();
    const totalPapers = papers.length;
    const cited = papers.filter((p) => p.status === "cited").length;
    const avgRelevance = totalPapers > 0 ? (papers.reduce((s, p) => s + p.relevance, 0) / totalPapers).toFixed(1) : "0";
    const uniqueVenues = new Set(papers.map((p) => p.venue)).size;

    const stats = [
        {
            label: "Papers",
            value: String(totalPapers),
            icon: "documents-outline" as keyof typeof Ionicons.glyphMap,
            color: theme.colors.primary
        },
        {
            label: "Cited",
            value: String(cited),
            icon: "link-outline" as keyof typeof Ionicons.glyphMap,
            color: theme.colors.tertiary
        },
        {
            label: "Avg Rel.",
            value: avgRelevance,
            icon: "star-outline" as keyof typeof Ionicons.glyphMap,
            color: "#f59e0b"
        },
        {
            label: "Venues",
            value: String(uniqueVenues),
            icon: "globe-outline" as keyof typeof Ionicons.glyphMap,
            color: "#059669"
        }
    ];

    return (
        <View style={styles.statsRow}>
            {stats.map((stat) => (
                <View key={stat.label} style={[styles.statCard, { backgroundColor: theme.colors.surfaceContainer }]}>
                    <Ionicons name={stat.icon} size={18} color={stat.color} />
                    <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
                    <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>{stat.label}</Text>
                </View>
            ))}
        </View>
    );
}

// --- Main Component ---

export function ResearchPapersPage() {
    const { theme } = useUnistyles();
    const [activeTab, setActiveTab] = React.useState<ReadingStatus>("to_read");
    const [expandedPaperId, setExpandedPaperId] = React.useState<string | null>(null);

    const filteredPapers = PAPERS.filter((p) => p.status === activeTab);

    const counts: Record<ReadingStatus, number> = {
        to_read: PAPERS.filter((p) => p.status === "to_read").length,
        reading: PAPERS.filter((p) => p.status === "reading").length,
        read: PAPERS.filter((p) => p.status === "read").length,
        cited: PAPERS.filter((p) => p.status === "cited").length
    };

    // Group filtered papers by field
    const groupedByField = React.useMemo(() => {
        const groups: { field: Field; papers: Paper[] }[] = [];
        const fieldOrder: Field[] = ["Machine Learning", "NLP", "Computer Vision", "Robotics", "Systems", "HCI"];
        for (const field of fieldOrder) {
            const fieldPapers = filteredPapers.filter((p) => p.field === field);
            if (fieldPapers.length > 0) {
                groups.push({ field, papers: fieldPapers });
            }
        }
        return groups;
    }, [filteredPapers]);

    const handleTogglePaper = (paperId: string) => {
        setExpandedPaperId((prev) => (prev === paperId ? null : paperId));
    };

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: theme.colors.surface }}
            contentContainerStyle={styles.scrollContent}
        >
            {/* Header */}
            <View style={styles.headerBlock}>
                <View style={styles.headerTitleRow}>
                    <Ionicons name="school-outline" size={24} color={theme.colors.primary} />
                    <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>Research Library</Text>
                </View>
                <Text style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                    Papers, citations, and reading progress
                </Text>
            </View>

            {/* Stats */}
            <StatsBar papers={PAPERS} />

            {/* Segmented Control */}
            <SegmentedControl activeTab={activeTab} onSelect={setActiveTab} counts={counts} />

            {/* Papers grouped by field */}
            {groupedByField.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="document-outline" size={48} color={theme.colors.outlineVariant} />
                    <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                        No papers in this category
                    </Text>
                </View>
            ) : (
                groupedByField.map((group) => (
                    <View key={group.field} style={styles.fieldGroup}>
                        <FieldAccentHeader field={group.field} count={group.papers.length} />
                        <View style={styles.paperList}>
                            {group.papers.map((paper) => (
                                <PaperCard
                                    key={paper.id}
                                    paper={paper}
                                    isExpanded={expandedPaperId === paper.id}
                                    onToggle={() => handleTogglePaper(paper.id)}
                                />
                            ))}
                        </View>
                    </View>
                ))
            )}
        </ScrollView>
    );
}

// --- Styles ---

const styles = StyleSheet.create((theme) => ({
    scrollContent: {
        maxWidth: 600,
        width: "100%",
        alignSelf: "center",
        paddingHorizontal: 16,
        paddingVertical: 20,
        gap: 20,
        paddingBottom: 40
    },

    // Header
    headerBlock: {
        gap: 4
    },
    headerTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    },
    headerTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 22,
        lineHeight: 28
    },
    headerSubtitle: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14,
        lineHeight: 20,
        marginLeft: 34
    },

    // Stats
    statsRow: {
        flexDirection: "row",
        gap: 8
    },
    statCard: {
        flex: 1,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 10,
        alignItems: "center",
        gap: 4
    },
    statValue: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 20,
        lineHeight: 26
    },
    statLabel: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        lineHeight: 14
    },

    // Segmented Control
    segmentedRow: {
        flexDirection: "row",
        borderRadius: 12,
        padding: 4,
        gap: 2
    },
    segmentItem: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderRadius: 10
    },
    segmentLabel: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12,
        lineHeight: 16
    },
    segmentCount: {
        borderRadius: 8,
        paddingHorizontal: 5,
        paddingVertical: 1
    },
    segmentCountText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 10,
        lineHeight: 14
    },

    // Venue Chip
    venueChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        borderWidth: 1
    },
    venueChipText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 10,
        lineHeight: 14
    },

    // Year Badge
    yearBadge: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6
    },
    yearBadgeText: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11,
        lineHeight: 16
    },

    // Field Header
    fieldHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    fieldAccentBar: {
        width: 4,
        height: 20,
        borderRadius: 2
    },
    fieldHeaderText: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 15,
        lineHeight: 22
    },
    fieldCountBadge: {
        paddingHorizontal: 7,
        paddingVertical: 1,
        borderRadius: 8
    },
    fieldCountText: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 11,
        lineHeight: 16
    },

    // Field Group
    fieldGroup: {
        gap: 10
    },
    paperList: {
        gap: 10
    },

    // Paper Card
    paperCard: {
        borderRadius: 12,
        overflow: "hidden",
        flexDirection: "row"
    },
    paperAccentStripe: {
        width: 4
    },
    paperContent: {
        flex: 1,
        padding: 14,
        gap: 8
    },
    paperTopRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8
    },
    paperTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 14,
        lineHeight: 20
    },
    paperAuthors: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 12,
        lineHeight: 16
    },
    expandRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: 2
    },
    expandHint: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        lineHeight: 16
    },

    // Detail Panel
    detailPanel: {
        marginTop: 8,
        gap: 16,
        borderTopWidth: 1,
        borderTopColor: theme.colors.outlineVariant,
        paddingTop: 14
    },
    detailSection: {
        gap: 8
    },
    detailSectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6
    },
    detailSectionTitle: {
        fontFamily: "IBMPlexSans-SemiBold",
        fontSize: 13,
        lineHeight: 18
    },
    abstractText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 20
    },

    // Key Findings
    findingRow: {
        flexDirection: "row",
        gap: 8,
        alignItems: "flex-start"
    },
    findingBullet: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginTop: 7
    },
    findingText: {
        flex: 1,
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 13,
        lineHeight: 20
    },

    // BibTeX
    bibtexBlock: {
        borderRadius: 8,
        padding: 12,
        borderWidth: 1
    },
    bibtexText: {
        fontFamily: "IBMPlexMono-Regular",
        fontSize: 11,
        lineHeight: 18
    },

    // Related Papers
    relatedPaperRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderWidth: 1,
        borderRadius: 8
    },
    relatedDot: {
        width: 8,
        height: 8,
        borderRadius: 4
    },
    relatedContent: {
        flex: 1,
        gap: 2
    },
    relatedTitle: {
        fontFamily: "IBMPlexSans-Medium",
        fontSize: 12,
        lineHeight: 16
    },
    relatedMeta: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 11,
        lineHeight: 14
    },

    // Empty State
    emptyState: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 60,
        gap: 12
    },
    emptyText: {
        fontFamily: "IBMPlexSans-Regular",
        fontSize: 14,
        lineHeight: 20
    }
}));
