/**
 * Microsoft & GitHub credential catalogue for the certification tracker.
 *
 * Extracted from certifications.html so the data can be maintained in one place
 * and unit-tested independently of the DOM (Johari #29 — decouple data + view).
 *
 * CATALOGUE_UPDATED drives the "Catalogue updated" freshness badge (#20/#25):
 * bump it whenever the poster data below is refreshed so users can judge staleness.
 *
 * Works in the browser (attaches to window.CertData) and under Node/Jest
 * (module.exports) so the same source feeds the page and the tests.
 */
(function (root, factory) {
    const data = factory();
    if (typeof module === "object" && module.exports) module.exports = data;
    else root.CertData = data;
})(typeof self !== "undefined" ? self : this, function () {
    "use strict";

    // Source posters + the date this catalogue was last reconciled against them.
    const CATALOGUE_UPDATED = "2026-07-01"; // Microsoft Certification Poster (July 2026)

    const CATEGORIES = [
        { key: "cloud",    name: "Cloud & AI Platforms", accent: "#0078d4", icon: "cloud" },
        { key: "aibiz",    name: "AI Business Solutions", accent: "#c239b3", icon: "briefcase-business" },
        { key: "security", name: "Security",              accent: "#498205", icon: "shield-check" },
    ];
    const CERT_LEVELS = ["Fundamentals", "Role-based", "Specialty", "Business"];
    const APPLIED_LEVELS = ["Beginner", "Intermediate"];

    const CERTS = [
        // ---- Cloud & AI Platforms ----
        { code: "AZ-900", title: "Azure Fundamentals", cat: "cloud", level: "Fundamentals", provider: "tech" },
        { code: "AI-901", title: "Azure AI Fundamentals", cat: "cloud", level: "Fundamentals", provider: "tech", isNew: true },
        { code: "DP-900", title: "Azure Data Fundamentals", cat: "cloud", level: "Fundamentals", provider: "tech" },

        { code: "AZ-104", title: "Azure Administrator Associate", cat: "cloud", level: "Role-based", provider: "tech" },
        { code: "AZ-802", title: "Windows Server Administrator Associate", cat: "cloud", level: "Role-based", provider: "tech", isNew: true },
        { code: "AZ-305", title: "Azure Solutions Architect Expert", cat: "cloud", level: "Role-based", provider: "tech", expert: true, prereq: true },
        { code: "AZ-400", title: "DevOps Engineer Expert", cat: "cloud", level: "Role-based", provider: "tech", expert: true, prereq: true },
        { code: "AZ-700", title: "Azure Network Engineer Associate", cat: "cloud", level: "Role-based", provider: "tech" },
        { code: "AI-103", title: "Azure AI Apps and Agents Developer Associate", cat: "cloud", level: "Role-based", provider: "tech" },
        { code: "AI-200", title: "Azure AI Cloud Developer Associate Certification", cat: "cloud", level: "Role-based", provider: "tech", isNew: true },
        { code: "AI-500", title: "Multi-Agent AI Solutions Expert Certification (Beta)", cat: "cloud", level: "Role-based", provider: "tech", expert: true, beta: true, isNew: true },
        { code: "AI-300", title: "Machine Learning Operations Engineer Associate", cat: "cloud", level: "Role-based", provider: "tech" },
        { code: "DP-300", title: "Azure Database Administrator Associate", cat: "cloud", level: "Role-based", provider: "tech" },
        { code: "DP-600", title: "Fabric Analytics Engineer Associate", cat: "cloud", level: "Role-based", provider: "tech" },
        { code: "DP-700", title: "Fabric Data Engineer Associate", cat: "cloud", level: "Role-based", provider: "tech" },
        { code: "DP-750", title: "Azure Databricks Data Engineer Associate", cat: "cloud", level: "Role-based", provider: "tech" },
        { code: "DP-800", title: "SQL AI Developer Associate", cat: "cloud", level: "Role-based", provider: "tech" },
        { code: "PL-300", title: "Power BI Data Analyst Associate", cat: "cloud", level: "Role-based", provider: "tech" },

        { code: "AZ-120", title: "Azure for SAP Workloads Specialty", cat: "cloud", level: "Specialty", provider: "tech" },
        { code: "AZ-140", title: "Azure Virtual Desktop Specialty", cat: "cloud", level: "Specialty", provider: "tech" },
        { code: "DP-420", title: "Azure Cosmos DB Developer Specialty", cat: "cloud", level: "Specialty", provider: "tech" },
        { code: "GH-900", title: "GitHub Foundations", cat: "cloud", level: "Specialty", provider: "github" },
        { code: "GH-100", title: "GitHub Administration", cat: "cloud", level: "Specialty", provider: "github" },
        { code: "GH-200", title: "GitHub Actions", cat: "cloud", level: "Specialty", provider: "github" },
        { code: "GH-300", title: "GitHub Copilot", cat: "cloud", level: "Specialty", provider: "github" },
        { code: "GH-600", title: "GitHub Agentic AI Developer", cat: "cloud", level: "Specialty", provider: "github", isNew: true },

        // ---- AI Business Solutions ----
        { code: "AB-900", title: "Microsoft 365 Copilot and Agent Administration Fundamentals", cat: "aibiz", level: "Fundamentals", provider: "business" },
        { code: "PL-900", title: "Power Platform Fundamentals", cat: "aibiz", level: "Fundamentals", provider: "tech" },

        { code: "MD-102", title: "Endpoint Administrator Associate", cat: "aibiz", level: "Role-based", provider: "tech" },
        { code: "MS-102", title: "Administrator Expert", cat: "aibiz", level: "Role-based", provider: "tech", expert: true, prereq: true },
        { code: "MS-721", title: "Collaboration Communications Systems Engineer Associate", cat: "aibiz", level: "Role-based", provider: "tech" },
        { code: "MS-700", title: "Teams Administrator Associate", cat: "aibiz", level: "Role-based", provider: "tech" },
        { code: "MB-230", title: "Dynamics 365 Customer Service Functional Consultant Associate", cat: "aibiz", level: "Role-based", provider: "tech" },
        { code: "MB-310", title: "Dynamics 365 Finance Functional Consultant Associate", cat: "aibiz", level: "Role-based", provider: "tech" },
        { code: "MB-330", title: "Dynamics 365 Supply Chain Management Functional Consultant Associate", cat: "aibiz", level: "Role-based", provider: "tech" },
        { code: "MB-500", title: "Dynamics 365: Finance and Operations Apps Developer Associate", cat: "aibiz", level: "Role-based", provider: "tech" },
        { code: "MB-800", title: "Dynamics 365 Business Central Functional Consultant Associate", cat: "aibiz", level: "Role-based", provider: "tech" },
        { code: "MB-820", title: "Dynamics 365 Business Central Developer Associate", cat: "aibiz", level: "Role-based", provider: "tech" },
        { code: "PL-200", title: "Power Platform Functional Consultant Associate", cat: "aibiz", level: "Role-based", provider: "tech" },
        { code: "PL-400", title: "Power Platform Developer Associate", cat: "aibiz", level: "Role-based", provider: "tech" },
        { code: "AB-100", title: "Agentic AI Business Solutions Architect", cat: "aibiz", level: "Role-based", provider: "business", expert: true, prereq: true, isNew: true },
        { code: "AB-620", title: "AI Agent Builder Associate", cat: "aibiz", level: "Role-based", provider: "business", isNew: true },
        { code: "AB-650", title: "AI Services Administrator Associate (Beta)", cat: "aibiz", level: "Role-based", provider: "business", beta: true, isNew: true },
        { code: "AB-210", title: "Dynamics 365 Sales AI Consultant Associate", cat: "aibiz", level: "Role-based", provider: "business", isNew: true },
        { code: "AB-250", title: "Dynamics 365 Contact Center AI Engineer Associate", cat: "aibiz", level: "Role-based", provider: "business", isNew: true },
        { code: "AB-410", title: "Intelligent Applications Builder Associate", cat: "aibiz", level: "Role-based", provider: "business", isNew: true },

        { code: "AB-730", title: "AI Business Professional", cat: "aibiz", level: "Business", provider: "business" },
        { code: "AB-731", title: "AI Transformation Leader", cat: "aibiz", level: "Business", provider: "business" },

        // ---- Security ----
        { code: "SC-900", title: "Security, Compliance, and Identity Fundamentals", cat: "security", level: "Fundamentals", provider: "tech" },

        { code: "AZ-500", title: "Azure Security Engineer Associate", cat: "security", level: "Role-based", provider: "tech" },
        { code: "SC-401", title: "Information Security Administrator Associate", cat: "security", level: "Role-based", provider: "tech" },
        { code: "SC-500", title: "Cloud and AI Security Engineer Associate Certification", cat: "security", level: "Role-based", provider: "tech", isNew: true },
        { code: "SC-100", title: "Cybersecurity Architect Expert", cat: "security", level: "Role-based", provider: "tech", expert: true, prereq: true },
        { code: "SC-200", title: "Security Operations Analyst Associate", cat: "security", level: "Role-based", provider: "tech" },
        { code: "SC-300", title: "Identity and Access Administrator Associate", cat: "security", level: "Role-based", provider: "tech" },

        { code: "GH-500", title: "GitHub Advanced Security", cat: "security", level: "Specialty", provider: "github" },
    ];

    // ---- Applied Skills (source: Microsoft Applied Skills Poster, May 2026) ----
    // No exam codes — a stable id is derived from the title by the consumer.
    const APPLIED_SKILLS = [
        // ---- Cloud & AI Platforms ----
        { title: "Create an AI agent", cat: "cloud", level: "Beginner", provider: "tech" },
        { title: "Get started with classes, properties, and methods in C#", cat: "cloud", level: "Beginner", provider: "tech" },
        { title: "Get started with cloud security and monitoring tasks", cat: "cloud", level: "Beginner", provider: "tech" },
        { title: "Get started with Azure management tasks", cat: "cloud", level: "Beginner", provider: "tech" },
        { title: "Get started developing agents in Microsoft Foundry", cat: "cloud", level: "Beginner", provider: "tech", isNew: true },

        { title: "Accelerate app development by using GitHub Copilot", cat: "cloud", level: "Intermediate", provider: "tech" },
        { title: "Administer Active Directory Domain Services", cat: "cloud", level: "Intermediate", provider: "tech" },
        { title: "Build a natural language processing solution with Azure AI Language", cat: "cloud", level: "Intermediate", provider: "tech" },
        { title: "Build AI-powered solutions by using Microsoft Azure Database for PostgreSQL", cat: "cloud", level: "Intermediate", provider: "tech" },
        { title: "Build a generative AI chat app", cat: "cloud", level: "Intermediate", provider: "tech" },
        { title: "Configure and migrate to Azure Database for PostgreSQL", cat: "cloud", level: "Intermediate", provider: "tech" },
        { title: "Configure secure access to your workloads using Azure networking", cat: "cloud", level: "Intermediate", provider: "tech" },
        { title: "Deploy and configure Azure Monitor", cat: "cloud", level: "Intermediate", provider: "tech" },
        { title: "Deploy cloud-native apps using Azure Container Apps", cat: "cloud", level: "Intermediate", provider: "tech" },
        { title: "Develop data-driven applications by using Microsoft Azure SQL Database", cat: "cloud", level: "Intermediate", provider: "tech" },
        { title: "Enhance agents with autonomous capabilities", cat: "cloud", level: "Intermediate", provider: "tech" },
        { title: "Implement a Real-Time Intelligence solution with Microsoft Fabric", cat: "cloud", level: "Intermediate", provider: "tech" },
        { title: "Implement a data warehouse in Microsoft Fabric", cat: "cloud", level: "Intermediate", provider: "tech" },
        { title: "Implement security through a pipeline using Azure DevOps", cat: "cloud", level: "Intermediate", provider: "tech" },
        { title: "Migrate SQL Server workloads to Azure SQL Database", cat: "cloud", level: "Intermediate", provider: "tech" },
        { title: "Secure storage for Azure Files and Azure Blob Storage", cat: "cloud", level: "Intermediate", provider: "tech" },
        { title: "Resolve GitHub issues by using GitHub Copilot", cat: "cloud", level: "Intermediate", provider: "tech", isNew: true },
        { title: "Integrate model context protocol tools with agents in Microsoft Foundry", cat: "cloud", level: "Intermediate", provider: "tech", isNew: true },

        // ---- AI Business Solutions ----
        { title: "Generate reports by using AI research agents", cat: "aibiz", level: "Beginner", provider: "business" },
        { title: "Streamline business workflows with AI chat", cat: "aibiz", level: "Beginner", provider: "business" },

        { title: "Automate Azure Load Testing by using GitHub Actions", cat: "aibiz", level: "Intermediate", provider: "tech" },
        { title: "Create agents in Microsoft Copilot Studio", cat: "aibiz", level: "Intermediate", provider: "business" },
        { title: "Create and manage automated processes by using Power Automate", cat: "aibiz", level: "Intermediate", provider: "business" },
        { title: "Create and manage canvas apps with Power Apps", cat: "aibiz", level: "Intermediate", provider: "business" },
        { title: "Create and manage model-driven apps with Power Apps and Dataverse", cat: "aibiz", level: "Intermediate", provider: "business" },
        { title: "Prepare security and compliance to support Copilot for Microsoft 365", cat: "aibiz", level: "Intermediate", provider: "business" },

        // ---- Security ----
        { title: "Get started with identities and access using Microsoft Entra", cat: "security", level: "Beginner", provider: "tech" },

        { title: "Defend against cyberthreats with Microsoft Defender XDR", cat: "security", level: "Intermediate", provider: "tech" },
        { title: "Secure AI solutions in the cloud", cat: "security", level: "Intermediate", provider: "tech" },
        { title: "Implement information protection and data loss prevention by using Microsoft Purview", cat: "security", level: "Intermediate", provider: "tech" },
        { title: "Secure Azure services and workloads with Microsoft Defender for Cloud regulatory compliance controls", cat: "security", level: "Intermediate", provider: "tech" },
        { title: "Implement retention, eDiscovery, and Communication Compliance in Microsoft Purview", cat: "security", level: "Intermediate", provider: "tech" },
        { title: "Protect information in Microsoft 365 Copilot by using Microsoft Purview", cat: "security", level: "Intermediate", provider: "tech", comingSoon: true },
    ];

    return { CATALOGUE_UPDATED, CATEGORIES, CERT_LEVELS, APPLIED_LEVELS, CERTS, APPLIED_SKILLS };
});
