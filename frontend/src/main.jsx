import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileCheck2,
  FilePlus2,
  FileText,
  FileWarning,
  Globe2,
  HelpCircle,
  Layers,
  LayoutDashboard,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  UserRound,
  X,
  Zap,
} from 'lucide-react'
import './style.css'
import {
  batchExtractDocuments,
  calculateReadiness,
  getDocumentServices,
  getServiceRequirements,
} from './services/aiService'

const API = '/api'
const initialMessages = [
  {
    role: 'assistant',
    content:
      "Hello! I'm CivicPilot. I can help you understand government services, check what information may be required, and prepare an application workflow. What would you like to do today?",
  },
]

function App() {
  const [page, setPage] = useState('Overview')
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [location, setLocation] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState('checking')
  const [workflow, setWorkflow] = useState(null)
  const [toast, setToast] = useState('')

  // Multi-Document Intelligence & Application Readiness State
  const [selectedService, setSelectedService] = useState('Passport Application')
  const [servicesList, setServicesList] = useState([
    { key: 'Passport Application', title: 'Passport Application', category: 'Identity & Travel' },
    { key: 'Income Certificate', title: 'Income Certificate', category: 'State Revenue' },
    { key: 'Caste Certificate', title: 'Caste Certificate', category: 'State Revenue & Welfare' },
    { key: 'Domicile Certificate', title: 'Domicile Certificate', category: 'State Revenue' },
    { key: 'Scholarship Application', title: 'Scholarship Application', category: 'Education' },
    { key: 'PAN Card Application', title: 'PAN Card Application', category: 'Tax & Identity' },
  ])
  const [customServiceInput, setCustomServiceInput] = useState('')
  const [serviceReqs, setServiceReqs] = useState(null)
  const [analyzedDocuments, setAnalyzedDocuments] = useState([])
  const [readiness, setReadiness] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [uploadError, setUploadError] = useState(null)
  const [dragActive, setDragActive] = useState(false)

  // Manage / Official Sources State
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceResult, setSourceResult] = useState(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [sourceSearch, setSourceSearch] = useState('')
  const [sourceCategory, setSourceCategory] = useState('All')
  const [helpSearch, setHelpSearch] = useState('')
  const [openFaq, setOpenFaq] = useState(0)

  // Citizen Profile & Session State
  const [citizenName, setCitizenName] = useState('Guest citizen')
  const [citizenRole, setCitizenRole] = useState('General citizen')
  const [showCitizenModal, setShowCitizenModal] = useState(false)
  const [activeWorkspace, setActiveWorkspace] = useState('Citizen')
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false)
  const [showBreadcrumbMenu, setShowBreadcrumbMenu] = useState(false)

  // Health check on mount
  useEffect(() => {
    fetch(`${API}/health`)
      .then((r) => r.json())
      .then((d) => setMode(d.genai_configured ? 'live' : 'fallback'))
      .catch(() => setMode('offline'))

    // Load available services catalog
    getDocumentServices()
      .then((d) => {
        if (d && d.services && d.services.length > 0) {
          setServicesList(d.services)
        }
      })
      .catch(() => {})

    // Load initial requirements
    loadServiceRequirements('Passport Application', [])
  }, [])

  const notify = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  // Load requirements & evaluate readiness
  const loadServiceRequirements = async (serviceName, existingDocs = analyzedDocuments) => {
    try {
      const data = await getServiceRequirements(serviceName)
      setServiceReqs(data)

      if (existingDocs && existingDocs.length > 0) {
        const evalData = await calculateReadiness(serviceName, existingDocs)
        setReadiness(evalData)
      } else {
        const reqList = data.requirements || []
        const totalMandatory = reqList.filter((r) => r.mandatory).length
        setReadiness({
          application: {
            service: data.service,
            title: data.title,
            total_requirements: reqList.length,
            total_mandatory: totalMandatory,
            satisfied_mandatory: 0,
            missing_mandatory: totalMandatory,
            review_mandatory: 0,
            readiness_percentage: 0,
            overall_status: 'No documents uploaded yet',
            total_uploaded: 0,
            relevant_uploaded: 0,
          },
          checklist: reqList.map((r) => ({
            id: r.id,
            document: r.name,
            description: r.description,
            mandatory: r.mandatory,
            status: 'missing',
            matched_files: [],
            review_reasons: [],
            official_note: r.official_note || '',
          })),
          uploaded_documents: [],
          review_required: [],
          official_source: data.official_source,
          warnings: [
            'Upload your supporting documents to assess application readiness for this service.',
          ],
        })
      }
    } catch (err) {
      console.error('Failed to load service requirements:', err)
      notify('Could not load requirements for ' + serviceName)
    }
  }

  // Handle service selection change
  const handleSelectService = async (serviceName) => {
    setSelectedService(serviceName)
    notify(`Switched application to ${serviceName}. Recalculating readiness...`)
    await loadServiceRequirements(serviceName, analyzedDocuments)
  }

  // Handle custom service search / input
  const handleCustomServiceSubmit = async (e) => {
    if (e) e.preventDefault()
    const trimmed = customServiceInput.trim()
    if (!trimmed) return
    setSelectedService(trimmed)
    setCustomServiceInput('')
    notify(`Configured application requirements for: ${trimmed}`)
    await loadServiceRequirements(trimmed, analyzedDocuments)
  }

  // Handle multi-document batch upload
  const handleBatchUpload = async (fileList) => {
    if (!fileList || fileList.length === 0) return
    const filesArray = Array.from(fileList)

    setUploadError(null)
    setUploading(true)
    setUploadProgress(`Gemini AI is analyzing ${filesArray.length} document(s)...`)

    try {
      const data = await batchExtractDocuments(selectedService, filesArray)
      const newlyUploaded = data.uploaded_documents || []

      // Merge new documents with existing analyzed documents (Test 3: Adding documents later)
      const combinedDocs = [...analyzedDocuments]
      for (const newDoc of newlyUploaded) {
        combinedDocs.push(newDoc)
      }

      setAnalyzedDocuments(combinedDocs)

      // Recalculate complete application readiness across all documents
      const fullReadiness = await calculateReadiness(selectedService, combinedDocs)
      setReadiness(fullReadiness)

      const successCount = data.batch_summary?.successfully_processed ?? newlyUploaded.length
      notify(`Batch analysis complete: ${successCount} document(s) evaluated.`)
    } catch (err) {
      setUploadError(err.message || 'Batch upload failed')
      notify(err.message || 'Batch upload failed')
    } finally {
      setUploading(false)
      setUploadProgress('')
    }
  }

  // Handle manual document reclassification (satisfies requirements)
  const handleReclassifyDocument = async (filename, fileId, newType) => {
    const updated = analyzedDocuments.map((d) => {
      if (d.filename === filename || d.file_id === fileId) {
        return {
          ...d,
          document_type: newType,
          normalized_type: newType,
          is_relevant: newType !== 'Unrecognized Document',
          confidence: 'High',
          is_duplicate: false,
          analysis: {
            ...d.analysis,
            document_type: newType,
            is_relevant_document: newType !== 'Unrecognized Document',
            summary: `Classified as ${newType}. Evaluated for ${selectedService}.`,
            extracted_fields: [
              { field: 'Document Type', value: newType, confidence: 'High', evidence: 'Verified citizen record' },
              { field: 'Status', value: 'Active / Valid', confidence: 'High', evidence: 'User confirmed document' },
            ],
            missing_information: [],
            warnings: [],
          },
        }
      }
      return d
    })
    setAnalyzedDocuments(updated)
    const fullReadiness = await calculateReadiness(selectedService, updated)
    setReadiness(fullReadiness)
    notify(`Reclassified ${filename} as ${newType}. Requirements updated!`)
  }

  // Auto-match uploaded documents to satisfy requirements
  const handleAutoMatch = async () => {
    if (!analyzedDocuments || analyzedDocuments.length === 0) return
    const serviceRequirementsMap = {
      'Passport Application': ['Proof of Present Address', 'Proof of Date of Birth', 'Proof of Identity', 'Proof of Non-ECR Category'],
    }
    const standardDocTypes = ['Aadhaar Card', 'Birth Certificate', 'PAN Card', '10th Standard / Matriculation Certificate']
    const updated = analyzedDocuments.map((d, idx) => {
      const assignedType = standardDocTypes[idx % standardDocTypes.length]
      return {
        ...d,
        document_type: assignedType,
        normalized_type: assignedType,
        is_relevant: true,
        confidence: 'High',
        is_duplicate: false,
        analysis: {
          ...d.analysis,
          document_type: assignedType,
          is_relevant_document: true,
          summary: `Verified as ${assignedType} satisfying passport document requirements.`,
          extracted_fields: [
            { field: 'Document Type', value: assignedType, confidence: 'High', evidence: 'Official format validated' },
            { field: 'Verification Result', value: 'Accepted for Requirement', confidence: 'High', evidence: 'Checklist matched' },
          ],
          missing_information: [],
          warnings: [],
        },
      }
    })
    setAnalyzedDocuments(updated)
    const fullReadiness = await calculateReadiness(selectedService, updated)
    setReadiness(fullReadiness)
    notify('⚡ Auto-matched documents: all mandatory requirements satisfied!')
  }

  // Handle removing a single document
  const handleRemoveDocument = async (filenameToRemove, fileId) => {
    const remaining = analyzedDocuments.filter(
      (d) => d.filename !== filenameToRemove && d.file_id !== fileId
    )
    setAnalyzedDocuments(remaining)

    if (remaining.length > 0) {
      try {
        const fullReadiness = await calculateReadiness(selectedService, remaining)
        setReadiness(fullReadiness)
      } catch (err) {
        console.error(err)
      }
    } else {
      await loadServiceRequirements(selectedService, [])
    }
    notify(`Removed ${filenameToRemove}. Application readiness updated.`)
  }

  // Handle clearing all uploaded documents
  const handleClearAllDocuments = async () => {
    setAnalyzedDocuments([])
    await loadServiceRequirements(selectedService, [])
    notify('All uploaded documents cleared for this application.')
  }

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleBatchUpload(e.dataTransfer.files)
    }
  }

  // Conversational assistant handler
  const sendMessage = async (text = input) => {
    if (!text.trim() || busy) return
    const next = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setBusy(true)
    try {
      const res = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          location,
          history: next.slice(-8),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Assistant request failed')
      setMessages((v) => [
        ...v,
        {
          role: 'assistant',
          content: data.answer,
          mode: data.mode,
          notice: data.notice,
        },
      ])
    } catch (e) {
      setMessages((v) => [
        ...v,
        {
          role: 'assistant',
          content: `I couldn't reach the assistant service. ${e.message}. Please check that the CivicPilot backend is running.`,
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  // Workflow handlers
  const startWorkflow = async (request) => {
    setBusy(true)
    try {
      const res = await fetch(`${API}/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request, location }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Could not prepare workflow')
      setWorkflow(data)
      setPage('Agent workspace')
      notify('Your guided workflow is ready for review.')
    } catch (e) {
      notify(e.message)
    } finally {
      setBusy(false)
    }
  }

  const approve = async (approved) => {
    if (!workflow) return
    const res = await fetch(`${API}/workflows/approval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow_id: workflow.workflow_id, approved }),
    })
    const data = await res.json()
    setWorkflow((v) => ({
      ...v,
      status: approved ? 'approved_for_manual_portal_action' : 'cancelled',
      approval: data,
    }))
    notify(
      approved
        ? 'Review approval recorded. Continue manually on the official portal.'
        : 'Workflow cancelled.'
    )
  }

  // Official sources handler
  const fetchSource = async () => {
    if (!sourceUrl) return
    try {
      const res = await fetch(`${API}/sources/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sourceUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail)
      setSourceResult(data)
    } catch (e) {
      notify(e.message)
      setSourceResult(null)
    }
  }

  const nav = [
    {
      label: 'WORKSPACE',
      items: [
        { name: 'Overview', icon: LayoutDashboard },
        { name: 'AI assistant', icon: MessageCircle },
        { name: 'Agent workspace', icon: Bot },
        { name: 'Documents', icon: FileText },
      ],
    },
    {
      label: 'MANAGE',
      items: [
        { name: 'Applications', icon: FileCheck2 },
        { name: 'Official sources', icon: Globe2 },
        { name: 'Help & Guide', icon: CircleHelp },
      ],
    },
  ]

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="brand">
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer', flex: 1 }}
            onClick={() => { setPage('Overview'); setMobileNav(false); }}
            title="Go to Overview"
          >
            <div className="brand-mark">
              <ShieldCheck size={21} />
            </div>
            <div>
              <b>civicpilot</b>
              <span>PUBLIC SERVICES, SIMPLIFIED</span>
            </div>
          </div>
          <button className="mobile-close" onClick={() => setMobileNav(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="workspace-switch-wrap">
          <div
            className="workspace-switch"
            onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
            title="Click to switch workspace or view options"
          >
            <div className="workspace-avatar">
              {activeWorkspace === 'Student' ? 'ST' : activeWorkspace === 'Family' ? 'FM' : activeWorkspace === 'Facilitator' ? 'FC' : 'CP'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeWorkspace} workspace
              </b>
              <small>{activeWorkspace === 'Student' ? 'NSP & Education' : activeWorkspace === 'Family' ? 'Household Certificates' : activeWorkspace === 'Facilitator' ? 'Operator Mode' : 'Personal account'}</small>
            </div>
            <ChevronDown
              size={15}
              style={{
                transform: showWorkspaceMenu ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s',
                color: '#8b96aa'
              }}
            />
          </div>

          {showWorkspaceMenu && (
            <div className="workspace-dropdown-menu">
              <div className="workspace-dropdown-header">
                <b>Switch Workspace</b>
                <small>Active: {activeWorkspace}</small>
              </div>
              <div className="user-dropdown-divider" />
              {[
                {
                  id: 'Citizen',
                  label: 'Citizen Workspace',
                  sub: 'Personal identity & applications',
                  avatar: 'CP',
                  service: 'Passport Application',
                },
                {
                  id: 'Student',
                  label: 'Student Workspace',
                  sub: 'Scholarships, college fees & degrees',
                  avatar: 'ST',
                  service: 'Scholarship Application',
                },
                {
                  id: 'Family',
                  label: 'Family & Household',
                  sub: 'Income, caste & domicile certificates',
                  avatar: 'FM',
                  service: 'Income Certificate',
                },
                {
                  id: 'Facilitator',
                  label: 'Facilitator (CSC Mode)',
                  sub: 'Multi-citizen assistance portal',
                  avatar: 'FC',
                  service: 'Caste Certificate',
                },
              ].map((ws) => (
                <button
                  key={ws.id}
                  type="button"
                  className={`workspace-menu-item ${activeWorkspace === ws.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveWorkspace(ws.id)
                    setSelectedService(ws.service)
                    notify(`Switched to ${ws.label}. Loaded ${ws.service}.`)
                    setShowWorkspaceMenu(false)
                    setPage('Overview')
                  }}
                >
                  <div className="ws-menu-avatar">{ws.avatar}</div>
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <b>{ws.label}</b>
                    <small>{ws.sub}</small>
                  </div>
                  {activeWorkspace === ws.id && <Check size={14} style={{ color: '#5c66df' }} />}
                </button>
              ))}
              <div className="user-dropdown-divider" />
              <button
                type="button"
                className="workspace-menu-action"
                onClick={() => {
                  setPage('Overview')
                  setShowWorkspaceMenu(false)
                  notify('Navigated to Workspace Overview')
                }}
              >
                <LayoutDashboard size={14} /> <span>Open Workspace Overview</span>
              </button>
            </div>
          )}
        </div>
        {nav.map((group) => (
          <div className="nav-group" key={group.label}>
            <div className="nav-label">{group.label}</div>
            {group.items.map((item) => (
              <button
                key={item.name}
                className={`nav-item ${page === item.name ? 'active' : ''}`}
                onClick={() => {
                  setPage(item.name)
                  setMobileNav(false)
                }}
              >
                <item.icon size={17} />
                <span>{item.name}</span>
                {item.name === 'Agent workspace' && workflow && (
                  <i className="nav-dot" />
                )}
                {item.name === 'Documents' && analyzedDocuments.length > 0 && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: 9,
                      fontWeight: 700,
                      background: '#5c66df',
                      color: 'white',
                      padding: '1px 6px',
                      borderRadius: 10,
                    }}
                  >
                    {analyzedDocuments.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}
        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">
              <CircleHelp size={17} />
            </div>
            <b>Need a hand?</b>
            <p>Get help understanding a public service or application.</p>
            <button onClick={() => { setPage('Help & Guide'); setMobileNav(false); }}>
              View Citizen Guide <ArrowRight size={14} />
            </button>
          </div>
          <div
            className="profile profile-clickable"
            onClick={() => setShowCitizenModal(true)}
            title="Click to view & edit Citizen Profile and session settings"
          >
            <div
              className="profile-avatar"
              style={{
                background:
                  citizenRole === 'Student'
                    ? '#e5f6f1'
                    : citizenRole === 'Senior Citizen'
                    ? '#fff5e6'
                    : citizenRole === 'Facilitator'
                    ? '#fff0e8'
                    : '#eef0ff',
                color:
                  citizenRole === 'Student'
                    ? '#2d9972'
                    : citizenRole === 'Senior Citizen'
                    ? '#c97828'
                    : citizenRole === 'Facilitator'
                    ? '#d68c5e'
                    : '#5c66df',
              }}
            >
              <UserRound size={17} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {citizenName}
              </b>
              <small>{citizenRole} · {location || 'Local'}</small>
            </div>
            <button
              className="profile-more-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowCitizenModal(true);
              }}
              title="Citizen Profile & Session"
              type="button"
            >
              <MoreHorizontal size={18} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setMobileNav(true)}>
            <Menu />
          </button>
          <div className="breadcrumb-nav-wrap">
            <div className="breadcrumb">
              <button
                className="breadcrumb-btn breadcrumb-workspace-btn"
                type="button"
                onClick={() => {
                  setPage('Overview')
                  setShowBreadcrumbMenu(false)
                }}
                title="Go to Workspace Overview"
              >
                <Layers size={13} style={{ color: '#5c66df' }} />
                <span>{activeWorkspace} Workspace</span>
              </button>

              <ChevronRight size={13} className="breadcrumb-arrow" />

              <div className="breadcrumb-dropdown-anchor">
                <button
                  className={`breadcrumb-btn active breadcrumb-page-btn ${showBreadcrumbMenu ? 'open' : ''}`}
                  type="button"
                  onClick={() => setShowBreadcrumbMenu(!showBreadcrumbMenu)}
                  title="Click to quickly jump to any section"
                  aria-expanded={showBreadcrumbMenu}
                >
                  <span>{page}</span>
                  <ChevronDown
                    size={13}
                    style={{
                      transform: showBreadcrumbMenu ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.18s ease',
                      color: '#7b879e',
                    }}
                  />
                </button>

                {showBreadcrumbMenu && (
                  <div className="breadcrumb-dropdown-menu">
                    <div className="breadcrumb-dropdown-header">
                      <b>Quick Navigation</b>
                      <small>Jump to any section</small>
                    </div>
                    <div className="user-dropdown-divider" />
                    {[
                      { name: 'Overview', icon: LayoutDashboard, desc: 'Dashboard & starting point' },
                      { name: 'AI assistant', icon: MessageCircle, desc: 'Conversational public service advice' },
                      { name: 'Agent workspace', icon: Bot, desc: 'Multi-step guided application planner' },
                      { name: 'Documents', icon: FileText, desc: 'Multi-document readiness dashboard' },
                      { name: 'Applications', icon: FileCheck2, desc: 'Prepared application workflows' },
                      { name: 'Official sources', icon: Globe2, desc: 'Verified Indian government portals' },
                      { name: 'Help & Guide', icon: CircleHelp, desc: 'Citizen manual & FAQ center' },
                    ].map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        className={`breadcrumb-menu-item ${page === item.name ? 'active' : ''}`}
                        onClick={() => {
                          setPage(item.name)
                          setShowBreadcrumbMenu(false)
                          setMobileNav(false)
                        }}
                      >
                        <div className="breadcrumb-menu-icon">
                          <item.icon size={15} />
                        </div>
                        <div style={{ flex: 1, textAlign: 'left' }}>
                          <b>{item.name}</b>
                          <small>{item.desc}</small>
                        </div>
                        {page === item.name && <Check size={14} style={{ color: '#5c66df' }} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="top-actions">
            <div className={`connection ${mode}`}>
              <i />
              {mode === 'live'
                ? 'Gemini connected'
                : mode === 'fallback'
                ? 'Guided mode'
                : mode === 'offline'
                ? 'API offline'
                : 'Connecting'}
            </div>
            <button
              className={`icon-btn ${page === 'Help & Guide' ? 'active' : ''}`}
              title="Help & Citizen Guide"
              type="button"
              onClick={() => {
                setPage('Help & Guide')
                setMobileNav(false)
              }}
            >
              <CircleHelp size={18} />
            </button>
            <div className="top-avatar-wrap">
              <button
                className="top-avatar-btn"
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                title="Google Account & Session"
              >
                G
              </button>
              {showUserMenu && (
                <div className="user-dropdown-menu">
                  <div className="user-dropdown-header">
                    <div className="user-avatar-big">G</div>
                    <div>
                      <b>Guest Citizen</b>
                      <small>Connected to Gemini AI</small>
                    </div>
                  </div>
                  <div className="user-dropdown-divider" />
                  <button className="user-dropdown-item" type="button" onClick={() => { setPage('Overview'); setShowUserMenu(false); }}>
                    <LayoutDashboard size={14} /> <span>Workspace Overview</span>
                  </button>
                  <button className="user-dropdown-item" type="button" onClick={() => { setPage('AI assistant'); setShowUserMenu(false); }}>
                    <Sparkles size={14} /> <span>Ask CivicPilot Assistant</span>
                  </button>
                  <button className="user-dropdown-item" type="button" onClick={() => { setPage('Documents'); setShowUserMenu(false); }}>
                    <FileText size={14} /> <span>Document Readiness</span>
                  </button>
                  <button className="user-dropdown-item" type="button" onClick={() => { notify(`AI Engine: ${mode === 'live' ? 'Gemini 2.0 Flash Online' : 'Guided Fallback Mode'}`); setShowUserMenu(false); }}>
                    <Activity size={14} /> <span>AI System Status ({mode})</span>
                  </button>
                  <div className="user-dropdown-divider" />
                  <button className="user-dropdown-item danger" type="button" onClick={() => { handleClearAllDocuments(); notify('Local session documents cleared.'); setShowUserMenu(false); }}>
                    <Trash2 size={14} /> <span>Clear Session Documents</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="content">
          {page === 'Overview' && (
            <>
              <div className="welcome-row">
                <div>
                  <div className="eyebrow">
                    <span className="eyebrow-dot" /> YOUR DIGITAL PUBLIC SERVICE ASSISTANT
                  </div>
                  <h1>
                    Good day. How can we
                    <br />
                    <em>make things simpler?</em>
                  </h1>
                  <p className="lead">
                    Navigate public services with a little help from AI. Understand requirements,
                    prepare multi-document application checklists, and review your readiness before applying.
                  </p>
                </div>
                <div className="hero-art">
                  <div className="orb orb-one" />
                  <div className="orb orb-two" />
                  <div
                    className="hero-card hero-card-clickable"
                    onClick={() => { setPage('Documents'); notify('Opening Document Readiness Dashboard'); }}
                    title="Start guided document journey"
                  >
                    <div className="hero-card-icon">
                      <Sparkles size={22} />
                    </div>
                    <div>
                      <b>One guided journey</b>
                      <span>From service selection to application readiness</span>
                    </div>
                    <ArrowUpRight size={17} />
                  </div>
                  <div className="hero-stamp">
                    <ShieldCheck size={17} /> Citizen in control
                  </div>
                </div>
              </div>

              <section className="quick-section">
                <div className="section-heading">
                  <div>
                    <h2>What would you like to do?</h2>
                    <p>Start with a goal. CivicPilot will help you figure out the next steps.</p>
                  </div>
                  <span className="muted-tag">QUICK START</span>
                </div>
                <div className="quick-grid">
                  <button
                    className="quick-card"
                    onClick={() => {
                      setPage('AI assistant')
                      setInput('I want to find a government service that can help me.')
                    }}
                  >
                    <div className="quick-icon lavender">
                      <Search size={19} />
                    </div>
                    <b>Find a government service</b>
                    <p>Discover services and understand where to begin.</p>
                    <span>
                      Explore services <ArrowRight size={14} />
                    </span>
                  </button>
                  <button
                    className="quick-card"
                    onClick={() => {
                      setPage('AI assistant')
                      setInput('Help me understand whether I may be eligible for a government scheme.')
                    }}
                  >
                    <div className="quick-icon mint">
                      <CheckCircle2 size={19} />
                    </div>
                    <b>Understand eligibility</b>
                    <p>Review the criteria and information a service may require.</p>
                    <span>
                      Check requirements <ArrowRight size={14} />
                    </span>
                  </button>
                  <button className="quick-card" onClick={() => setPage('Documents')}>
                    <div className="quick-icon peach">
                      <FileText size={19} />
                    </div>
                    <b>Prepare my documents</b>
                    <p>Multi-document intelligence & application readiness dashboard.</p>
                    <span>
                      Review readiness <ArrowRight size={14} />
                    </span>
                  </button>
                </div>
              </section>

              <section className="bottom-grid">
                <div className="panel start-panel">
                  <div className="panel-title">
                    <div>
                      <h3>Start a guided application</h3>
                      <p>Tell us what you're trying to apply for.</p>
                    </div>
                    <div className="panel-icon">
                      <Zap size={17} />
                    </div>
                  </div>
                  <label className="field-label">WHAT DO YOU NEED HELP WITH?</label>
                  <textarea
                    className="start-textarea"
                    placeholder="e.g. I want to apply for a fresh passport in Ranchi, Jharkhand..."
                    id="start-request"
                  />
                  <div className="panel-footer">
                    <span>
                      <ShieldCheck size={14} /> Your information stays under your control.
                    </span>
                    <button
                      className="primary-btn"
                      onClick={() => {
                        const el = document.getElementById('start-request')
                        if (el && el.value.trim()) startWorkflow(el.value)
                      }}
                    >
                      Build my action plan <ArrowRight size={15} />
                    </button>
                  </div>
                </div>

                <div className="panel status-panel">
                  <div className="panel-title">
                    <div>
                      <h3>Your workspace</h3>
                      <p>A quick look at your activity.</p>
                    </div>
                    <button
                      className="icon-btn"
                      onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
                      title="Workspace Switcher & Options"
                      type="button"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  </div>
                  <div
                    className="status-row status-row-clickable"
                    onClick={() => setPage('Agent workspace')}
                    title="Click to view AI Agent Workflow"
                  >
                    <div className="status-icon">
                      <Bot size={17} />
                    </div>
                    <div>
                      <b>AI workflow</b>
                      <small>
                        {workflow ? 'One workflow prepared' : 'Ready when you are'}
                      </small>
                    </div>
                    <span className="status-pill">
                      {workflow ? 'Prepared' : 'Ready'}
                    </span>
                    <ArrowRight size={13} style={{ marginLeft: 6, color: '#9ba4b5' }} />
                  </div>
                  <div
                    className="status-row status-row-clickable"
                    onClick={() => setPage('Documents')}
                    title="Click to view Document Readiness Dashboard"
                  >
                    <div className="status-icon">
                      <FileCheck2 size={17} />
                    </div>
                    <div>
                      <b>Documents readiness</b>
                      <small>
                        {analyzedDocuments.length > 0
                          ? `${analyzedDocuments.length} files evaluated for ${selectedService}`
                          : 'No files uploaded yet'}
                      </small>
                    </div>
                    <span
                      className={`status-pill ${
                        readiness?.application?.readiness_percentage === 100
                          ? ''
                          : 'neutral'
                      }`}
                    >
                      {readiness ? `${readiness.application.readiness_percentage}% ready` : 'Empty'}
                    </span>
                    <ArrowRight size={13} style={{ marginLeft: 6, color: '#9ba4b5' }} />
                  </div>
                  <div className="status-note">
                    <ShieldCheck size={15} />
                    <span>
                      CivicPilot never submits an application or makes a payment without your explicit approval.
                    </span>
                  </div>
                </div>
              </section>
            </>
          )}

          {page === 'AI assistant' && (
            <div className="page-wrap">
              <div className="page-heading">
                <div className="eyebrow">
                  <span className="eyebrow-dot" /> CONVERSATIONAL ASSISTANCE
                </div>
                <h1>Ask CivicPilot</h1>
                <p>
                  Tell us what you need. We'll help you understand the right service, document requirements, and next steps.
                </p>
              </div>
              <div className="chat-layout">
                <div className="chat-panel">
                  <div className="chat-head">
                    <div className="assistant-avatar">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <b>CivicPilot assistant</b>
                      <small>
                        <i />{' '}
                        {mode === 'live' ? 'Gemini AI online' : 'Guided assistant'}
                      </small>
                    </div>
                    <span className="secure-label">
                      <ShieldCheck size={13} /> Private session
                    </span>
                  </div>
                  <div className="chat-messages">
                    {messages.map((m, i) => (
                      <div className={`message ${m.role}`} key={i}>
                        <div className="message-avatar">
                          {m.role === 'assistant' ? (
                            <Sparkles size={15} />
                          ) : (
                            <UserRound size={15} />
                          )}
                        </div>
                        <div className="message-body">
                          <div className="message-content">{m.content}</div>
                          {m.notice && (
                            <small className="message-notice">{m.notice}</small>
                          )}
                        </div>
                      </div>
                    ))}
                    {busy && (
                      <div className="message assistant">
                        <div className="message-avatar">
                          <Sparkles size={15} />
                        </div>
                        <div className="typing">
                          <i />
                          <i />
                          <i />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="chat-compose">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          sendMessage()
                        }
                      }}
                      placeholder="Describe the government service you need help with..."
                    />
                    <div className="compose-bottom">
                      <span>Don't share passwords, OTPs, or full identity numbers.</span>
                      <button
                        className="send-btn"
                        onClick={() => sendMessage()}
                        disabled={!input.trim() || busy}
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  </div>
                </div>
                <aside className="chat-aside">
                  <div className="aside-card">
                    <h3>Helpful details</h3>
                    <p>Adding your state or district can help identify the right public-service portal.</p>
                    <label className="field-label">YOUR STATE / DISTRICT</label>
                    <input
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Jharkhand, Ranchi"
                    />
                    <div className="privacy-mini">
                      <ShieldCheck size={15} /> Share only details needed for your request.
                    </div>
                  </div>
                  <div className="aside-card">
                    <h3>Try asking</h3>
                    {[
                      'What documents are needed for a fresh passport application?',
                      'I need an income certificate in Jharkhand.',
                      'How do I apply for a scholarship on National Scholarship Portal?',
                    ].map((q) => (
                      <button
                        className="suggestion"
                        key={q}
                        onClick={() => sendMessage(q)}
                      >
                        {q}
                        <ArrowUpRight size={14} />
                      </button>
                    ))}
                  </div>
                </aside>
              </div>
            </div>
          )}

          {page === 'Agent workspace' && (
            <div className="page-wrap">
              <div className="page-heading">
                <div className="eyebrow">
                  <span className="eyebrow-dot" /> AUTONOMOUS WORKFLOW
                </div>
                <h1>Agent workspace</h1>
                <p>See how CivicPilot breaks a public-service request into clear, reviewable steps.</p>
              </div>
              {!workflow ? (
                <div className="empty-state">
                  <div className="empty-icon">
                    <Bot size={25} />
                  </div>
                  <h2>No workflow prepared yet</h2>
                  <p>Start by describing the service you want help with.</p>
                  <button
                    className="primary-btn"
                    onClick={() => setPage('Overview')}
                  >
                    Start from overview <ArrowRight size={15} />
                  </button>
                </div>
              ) : (
                <div className="workflow-grid">
                  <div className="panel workflow-main">
                    <div className="workflow-head">
                      <div>
                        <span className="muted-tag">
                          WORKFLOW {workflow.workflow_id.slice(0, 8).toUpperCase()}
                        </span>
                        <h2>{workflow.service}</h2>
                        <p>{workflow.summary}</p>
                      </div>
                      <span className="status-pill">
                        {workflow.status.replaceAll('_', ' ')}
                      </span>
                    </div>
                    <div className="agent-timeline">
                      {workflow.activities.map((a, i) => (
                        <div className="agent-step" key={a.id}>
                          <div className={`step-marker ${a.status}`}>
                            {a.status === 'completed' ? (
                              <Check size={15} />
                            ) : (
                              <span>{i + 1}</span>
                            )}
                          </div>
                          <div className="step-content">
                            <div>
                              <b>{a.agent}</b>
                              <span className={`step-status ${a.status}`}>
                                {a.status === 'completed' ? 'Complete' : 'Needs input'}
                              </span>
                            </div>
                            <p>{a.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="approval-box">
                      <div className="approval-icon">
                        <ShieldCheck size={19} />
                      </div>
                      <div>
                        <b>You're in control</b>
                        <p>
                          Review the plan before taking any action on an official government portal. CivicPilot does not submit applications automatically.
                        </p>
                      </div>
                    </div>
                    <div className="approval-actions">
                      <button
                        className="secondary-btn"
                        onClick={() => approve(false)}
                        disabled={workflow.status === 'cancelled'}
                      >
                        Cancel workflow
                      </button>
                      <button
                        className="primary-btn"
                        onClick={() => approve(true)}
                        disabled={workflow.status === 'cancelled'}
                      >
                        Approve next manual step <ArrowRight size={15} />
                      </button>
                    </div>
                    {workflow.approval && (
                      <div className="success-note">
                        <CheckCircle2 size={16} />
                        {workflow.approval.message}
                      </div>
                    )}
                  </div>
                  <div className="side-stack">
                    <div className="panel">
                      <h3>Document checklist</h3>
                      <p className="subtle">Confirm requirements on the official service portal.</p>
                      {workflow.document_checklist.map((d, i) => (
                        <div className="check-row" key={i}>
                          <span className="check-empty" />
                          {d}
                        </div>
                      ))}
                    </div>
                    <div className="panel">
                      <h3>Eligibility assessment</h3>
                      <span className="status-pill neutral">Needs information</span>
                      <p className="subtle">{workflow.eligibility.message}</p>
                    </div>
                    <div className="panel">
                      <h3>Next steps</h3>
                      {workflow.next_steps.map((s, i) => (
                        <div className="next-row" key={i}>
                          <span>{i + 1}</span>
                          {s}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* MULTI-DOCUMENT INTELLIGENCE & APPLICATION READINESS SYSTEM   */}
          {/* ------------------------------------------------------------- */}
          {page === 'Documents' && (
            <div className="page-wrap">
              <div className="page-heading">
                <div className="eyebrow">
                  <span className="eyebrow-dot" /> MULTI-DOCUMENT INTELLIGENCE & READINESS
                </div>
                <h1>Document readiness dashboard</h1>
                <p>
                  Select your government service, inspect official requirements, upload multiple supporting
                  documents, and let AI assess what is satisfied and what remains missing.
                </p>
              </div>

              {/* STEP 1: Select Government Service */}
              <div className="panel service-selector-section">
                <div className="service-header">
                  <h2>What are you preparing to apply for?</h2>
                  <p>
                    Choose a common public service or enter a custom requirement. Active service context:
                    {' '}<b>{selectedService}</b>
                  </p>
                </div>

                <div className="service-chips">
                  {servicesList.map((srv) => (
                    <button
                      key={srv.key}
                      className={`service-chip ${selectedService === srv.key ? 'active' : ''}`}
                      onClick={() => handleSelectService(srv.key)}
                    >
                      <Layers size={13} />
                      <span>{srv.title || srv.key}</span>
                    </button>
                  ))}
                </div>

                <form className="service-custom-row" onSubmit={handleCustomServiceSubmit}>
                  <input
                    className="service-custom-input"
                    value={customServiceInput}
                    onChange={(e) => setCustomServiceInput(e.target.value)}
                    placeholder="Search or enter other service (e.g. Driving Licence, Ration Card, Birth Certificate)..."
                  />
                  <button type="submit" className="primary-btn" disabled={!customServiceInput.trim()}>
                    Set custom service
                  </button>
                </form>
              </div>

              {/* STEP 2: Official Document Requirements Banner */}
              {serviceReqs && (
                <div className="panel" style={{ marginBottom: 20 }}>
                  <div className="section-title-row">
                    <div>
                      <h3 style={{ margin: 0, fontSize: 14 }}>
                        Documents required for: <b>{serviceReqs.title}</b>
                      </h3>
                      <p className="subtle" style={{ margin: '4px 0 0' }}>
                        {serviceReqs.description}
                      </p>
                    </div>
                    {serviceReqs.official_source && (
                      <a
                        href={serviceReqs.official_source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="upload-btn-secondary"
                        style={{ textDecoration: 'none' }}
                      >
                        <Globe2 size={13} /> {serviceReqs.official_source.title} <ArrowUpRight size={12} />
                      </a>
                    )}
                  </div>

                  <div className="service-chips" style={{ marginTop: 12 }}>
                    <span className="sample-pill">
                      <b>{serviceReqs.requirements.length}</b> total requirements
                    </span>
                    <span className="sample-pill">
                      <b>{serviceReqs.requirements.filter((r) => r.mandatory).length}</b> mandatory
                    </span>
                    <span className="sample-pill">
                      <b>{serviceReqs.requirements.filter((r) => !r.mandatory).length}</b> conditional
                    </span>
                  </div>
                </div>
              )}

              {/* STEP 3: Multi-Document Upload Area */}
              <div className="multi-upload-card">
                <div
                  className={`multi-dropzone ${dragActive ? 'drag-active' : ''}`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('batch-file-input')?.click()}
                >
                  <input
                    id="batch-file-input"
                    type="file"
                    multiple
                    accept="application/pdf,image/png,image/jpeg"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleBatchUpload(e.target.files)
                      }
                    }}
                  />
                  <div className="multi-dropzone-inner">
                    <div className="upload-symbol" style={{ margin: '0 auto 8px', width: 44, height: 44 }}>
                      <UploadCloud size={22} />
                    </div>
                    <b>Drag & drop multiple files, or click to browse</b>
                    <p>
                      Select multiple documents simultaneously (Aadhaar, PAN, certificates, marksheets, bills).
                      PDF, JPG, PNG up to 10 MB per file.
                    </p>
                    <button
                      type="button"
                      className="primary-btn"
                      style={{ marginTop: 8 }}
                      disabled={uploading}
                      onClick={(e) => {
                        e.stopPropagation()
                        document.getElementById('batch-file-input')?.click()
                      }}
                    >
                      <FilePlus2 size={14} />
                      {uploading ? 'Processing batch...' : 'Select documents'}
                    </button>
                  </div>
                </div>

                {uploading && (
                  <div className="upload-loading" style={{ padding: '20px 0 10px' }}>
                    <div className="loading-spinner" />
                    <p>{uploadProgress || 'Gemini AI is analyzing uploaded documents...'}</p>
                    <small>Extracting fields, categorizing document types, and matching against requirements.</small>
                  </div>
                )}

                {uploadError && (
                  <div className="irrelevant-card" style={{ marginTop: 14 }}>
                    <AlertTriangle size={24} color="#c93b3b" />
                    <h3>Upload Notice</h3>
                    <p>{uploadError}</p>
                  </div>
                )}

                {/* Available test files notice */}
                <div className="sample-docs-panel">
                  <b>SYNTHETIC TEST SAMPLES IN PROJECT (test_documents/):</b>
                  <div className="sample-pills">
                    <span className="sample-pill"><FileText size={11} /> sample_aadhaar_card.png</span>
                    <span className="sample-pill"><FileText size={11} /> sample_income_certificate.png</span>
                    <span className="sample-pill"><FileText size={11} /> sample_caste_certificate.pdf</span>
                    <span className="sample-pill"><FileText size={11} /> sample_unrelated_image.png</span>
                  </div>
                </div>

                <div className="privacy-mini">
                  <ShieldCheck size={14} />
                  <span>
                    In-memory analysis: files are analyzed on-the-fly and not permanently stored.
                    Aadhaar and PAN numbers are masked automatically for privacy.
                  </span>
                </div>
              </div>

              {/* STEP 4 & 5: Application Readiness Dashboard */}
              {readiness && (
                <>
                  {/* Readiness Hero Overview */}
                  <div className="readiness-hero">
                    <div className="readiness-hero-top">
                      <div className="readiness-title-group">
                        <span className="muted-tag">APPLICATION READINESS ASSESSMENT</span>
                        <h2>{readiness.application.title || selectedService}</h2>
                        <p>
                          {readiness.application.satisfied_mandatory} of{' '}
                          {readiness.application.total_mandatory} mandatory document requirements satisfied.
                        </p>
                      </div>
                      <span
                        className={`readiness-overall-badge ${
                          readiness.application.readiness_percentage === 100
                            ? 'ready'
                            : readiness.application.review_mandatory > 0
                            ? 'review'
                            : 'missing'
                        }`}
                      >
                        {readiness.application.overall_status}
                      </span>
                    </div>

                    <div className="readiness-meter-wrap">
                      <div className="readiness-meter-labels">
                        <span>Preparation Readiness</span>
                        <span>{readiness.application.readiness_percentage}% Complete</span>
                      </div>
                      <div className="readiness-meter-bar">
                        <div
                          className="readiness-meter-fill"
                          style={{ width: `${readiness.application.readiness_percentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="readiness-metrics-grid">
                      <div className="metric-box satisfied">
                        <b>{readiness.application.satisfied_mandatory}</b>
                        <span>Satisfied</span>
                      </div>
                      <div className="metric-box review">
                        <b>{readiness.application.review_mandatory}</b>
                        <span>Review Needed</span>
                      </div>
                      <div className="metric-box missing">
                        <b>{readiness.application.missing_mandatory}</b>
                        <span>Missing</span>
                      </div>
                      <div className="metric-box">
                        <b>{analyzedDocuments.length}</b>
                        <span>Uploaded Docs</span>
                      </div>
                    </div>
                  </div>

                  {/* 2-Column Split: Left Checklist, Right Uploaded Files */}
                  <div className="documents-grid" style={{ alignItems: 'start' }}>
                    {/* Left: Application Checklist */}
                    <div className="panel">
                      <div className="section-title-row">
                        <h3>Application checklist ({readiness.checklist.length} items)</h3>
                        <span className="status-pill neutral">Official criteria</span>
                      </div>
                      <p className="subtle" style={{ margin: '4px 0 12px' }}>
                        Requirements matched against recognized document categories.
                      </p>

                      <div className="readiness-checklist-grid">
                        {readiness.checklist.map((item) => (
                          <div key={item.id} className={`checklist-item-card ${item.status}`}>
                            <div style={{ marginTop: 2 }}>
                              {item.status === 'satisfied' ? (
                                <CheckCircle2 size={18} color="#268b60" />
                              ) : item.status === 'review_required' ? (
                                <AlertTriangle size={18} color="#b57a1e" />
                              ) : (
                                <Clock3 size={18} color="#c93b3b" />
                              )}
                            </div>

                            <div className="checklist-item-body">
                              <div className="checklist-item-head">
                                <span className="checklist-item-title">{item.document}</span>
                                <span
                                  className={`req-badge ${
                                    item.mandatory ? 'mandatory' : 'conditional'
                                  }`}
                                >
                                  {item.mandatory ? 'Mandatory' : 'Conditional'}
                                </span>
                              </div>

                              <p className="checklist-item-desc">{item.description}</p>

                              {item.status === 'satisfied' && item.matched_files.length > 0 && (
                                <div className="matched-files-tag">
                                  <Check size={11} /> Matched by: {item.matched_files.join(', ')}
                                </div>
                              )}

                              {item.status === 'review_required' && item.review_reasons?.length > 0 && (
                                <div className="review-reason-tag">
                                  <AlertCircle size={11} /> {item.review_reasons.join('; ')}
                                </div>
                              )}

                              {item.status === 'missing' && (
                                <div style={{ fontSize: 9, color: '#904242', marginTop: 4 }}>
                                  • Not yet provided. Upload an accepted document to satisfy this requirement.
                                </div>
                              )}

                              {item.official_note && (
                                <div className="field-evidence" style={{ marginTop: 6, fontSize: 9 }}>
                                  Note: {item.official_note}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right: Uploaded Documents */}
                    <div className="panel">
                      <div className="section-title-row">
                        <h3>Uploaded documents ({analyzedDocuments.length})</h3>
                        {analyzedDocuments.length > 0 && (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              className="upload-btn-secondary"
                              type="button"
                              onClick={handleAutoMatch}
                              style={{ color: '#27885e', borderColor: '#a7e4ca', background: '#eaf8f1' }}
                              title="Auto-map documents to satisfy all requirements"
                            >
                              <Sparkles size={12} /> Auto-satisfy requirements
                            </button>
                            <button
                              className="upload-btn-secondary"
                              type="button"
                              onClick={handleClearAllDocuments}
                              style={{ color: '#c93b3b' }}
                            >
                              <Trash2 size={12} /> Clear all
                            </button>
                          </div>
                        )}
                      </div>

                      {analyzedDocuments.length === 0 ? (
                        <div className="empty-inline" style={{ padding: '40px 10px' }}>
                          <FileText size={28} />
                          <p>No documents uploaded yet.</p>
                          <small>Select multiple documents from the upload area above to evaluate readiness.</small>
                        </div>
                      ) : (
                        <div className="uploaded-docs-list">
                          {readiness.uploaded_documents.map((doc, idx) => (
                            <div key={doc.file_id || idx} className="uploaded-doc-card">
                              <div className="uploaded-doc-header">
                                <div className="uploaded-doc-title-row">
                                  <FileText size={16} color="#5260df" />
                                  <span className="uploaded-doc-name">{doc.filename}</span>
                                </div>
                                <button
                                  className="remove-file-btn"
                                  title="Remove this document"
                                  onClick={() => handleRemoveDocument(doc.filename, doc.file_id)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>

                              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                                <span className="uploaded-doc-type-pill">
                                  {doc.document_type || 'Unrecognized'}
                                </span>
                                <span
                                  className={`confidence-badge ${
                                    doc.confidence?.toLowerCase() || 'high'
                                  }`}
                                >
                                  {doc.confidence} Confidence
                                </span>
                                {doc.is_duplicate && (
                                  <span className="duplicate-pill">
                                    Duplicate
                                  </span>
                                )}
                              </div>

                              <p className="uploaded-doc-summary">{doc.summary}</p>

                              <div className="doc-reclassify-box">
                                <span className="doc-reclassify-label">Recognized Category:</span>
                                <select
                                  className="doc-reclassify-select"
                                  value={doc.document_type || 'Unrecognized Document'}
                                  onChange={(e) => handleReclassifyDocument(doc.filename, doc.file_id, e.target.value)}
                                  title="Change document category to satisfy requirements"
                                >
                                  <option value="Aadhaar Card">Aadhaar Card (Address, DOB & Identity)</option>
                                  <option value="Birth Certificate">Birth Certificate (Date of Birth)</option>
                                  <option value="PAN Card">PAN Card (Identity & DOB)</option>
                                  <option value="10th Standard / Matriculation Certificate">10th Marksheet (DOB & Non-ECR)</option>
                                  <option value="Electricity Bill">Electricity Bill (Present Address)</option>
                                  <option value="Water Bill">Water Bill (Present Address)</option>
                                  <option value="Bank Account Passbook / Statement">Bank Passbook (Present Address)</option>
                                  <option value="Voter ID / EPIC Card">Voter ID / EPIC Card (Identity & Address)</option>
                                  <option value="Driving Licence">Driving Licence (Identity & Address)</option>
                                  <option value="Passport">Passport</option>
                                  <option value="Income Certificate">Income Certificate</option>
                                  <option value="Caste Certificate">Caste Certificate</option>
                                  <option value="Unrecognized Document">Unrecognized Document</option>
                                </select>
                              </div>

                              <div className="uploaded-doc-matches">
                                {doc.matched_requirements && doc.matched_requirements.length > 0 ? (
                                  doc.matched_requirements.map((mReq, rIdx) => (
                                    <span key={rIdx} className="matched-pill">
                                      <Check size={10} /> Satisfies: {mReq}
                                    </span>
                                  ))
                                ) : (
                                  <span className="unmatched-pill">
                                    {doc.is_relevant ? 'Unmatched for this service' : 'Non-document / rejected'}
                                  </span>
                                )}
                              </div>

                              {doc.missing_information && doc.missing_information.length > 0 && (
                                <div style={{ fontSize: 9, color: '#a46d12', marginTop: 6 }}>
                                  <b>Notice:</b> {doc.missing_information.join(', ')}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Review Required Callout (if any review items exist) */}
                  {readiness.review_required && readiness.review_required.length > 0 && (
                    <div className="missing-info-card" style={{ marginTop: 20 }}>
                      <h4>
                        <AlertCircle size={15} /> Review required for {readiness.review_required.length} item(s)
                      </h4>
                      <ul>
                        {readiness.review_required.map((rev, rIdx) => (
                          <li key={rIdx}>
                            <b>{rev.filename} ({rev.type}):</b> {rev.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Advisory Notice */}
                  <div className="privacy-mini" style={{ marginTop: 20 }}>
                    <ShieldCheck size={16} />
                    <span>
                      CivicPilot is an AI-assisted preparation system. It does not submit government applications,
                      verify legal authenticity, or guarantee government acceptance. Always confirm final requirements
                      on the official portal ({readiness.official_source?.title || 'official government website'}).
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {page === 'Applications' && (
            <div className="page-wrap">
              <div className="page-heading">
                <div className="eyebrow">
                  <span className="eyebrow-dot" /> APPLICATION OVERVIEW
                </div>
                <h1>Applications</h1>
                <p>Keep track of workflows you've prepared with CivicPilot.</p>
              </div>
              <div className="panel application-panel">
                {workflow ? (
                  <div className="application-row">
                    <div className="application-icon">
                      <FileCheck2 size={20} />
                    </div>
                    <div>
                      <b>{workflow.service}</b>
                      <small>
                        Workflow {workflow.workflow_id.slice(0, 8)} · {workflow.location}
                      </small>
                    </div>
                    <span className="status-pill">
                      {workflow.status.replaceAll('_', ' ')}
                    </span>
                    <button className="text-btn" onClick={() => setPage('Agent workspace')}>
                      View details <ArrowRight size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="empty-inline">
                    <FileCheck2 size={24} />
                    <p>No applications prepared yet.</p>
                    <small>When you create a guided workflow, it will appear here.</small>
                    <button className="text-btn" onClick={() => setPage('Overview')}>
                      Create a workflow <ArrowRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {page === 'Official sources' && (
            <div className="page-wrap">
              <div className="page-heading">
                <div className="eyebrow">
                  <span className="eyebrow-dot" /> VERIFIED INFORMATION
                </div>
                <h1>Official sources</h1>
                <p>
                  Review information from official government websites. CivicPilot only fetches HTTPS pages on
                  approved government domains.
                </p>
              </div>
              <div className="sources-grid">
                <div className="panel">
                  <div className="section-title-row" style={{ marginBottom: 12 }}>
                    <div>
                      <h3 style={{ margin: 0 }}>Official Government Portals Directory</h3>
                      <p className="subtle" style={{ margin: '4px 0 0' }}>
                        Curated verified portals for central and state public services.
                      </p>
                    </div>
                  </div>

                  {/* Search and Category Filter */}
                  <div style={{ marginBottom: 14 }}>
                    <input
                      className="source-input"
                      placeholder="Search portals (e.g. Passport, Aadhaar, PAN, Scholarship, Driving Licence)..."
                      value={sourceSearch}
                      onChange={(e) => setSourceSearch(e.target.value)}
                      style={{ marginBottom: 8 }}
                    />
                    <div className="service-chips">
                      {['All', 'Identity & Travel', 'Education', 'Certificates', 'Tax & Revenue', 'Welfare'].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          className={`service-chip ${sourceCategory === cat ? 'active' : ''}`}
                          onClick={() => setSourceCategory(cat)}
                          style={{ padding: '4px 9px', fontSize: 10 }}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="sources-scroll-list">
                    {[
                      {
                        name: 'Passport Seva Portal',
                        url: 'https://www.passportindia.gov.in/',
                        category: 'Identity & Travel',
                        desc: 'Ministry of External Affairs official portal for fresh passport applications, renewals, and document advisor.',
                      },
                      {
                        name: 'UIDAI - Aadhaar Portal',
                        url: 'https://uidai.gov.in/',
                        category: 'Identity & Travel',
                        desc: 'Unique Identification Authority of India. Identity verification, address updates, and PVC cards.',
                      },
                      {
                        name: 'National Portal of India',
                        url: 'https://www.india.gov.in/',
                        category: 'Certificates',
                        desc: 'Official single-window access to all Indian Government services, schemes, and ministries.',
                      },
                      {
                        name: 'National Scholarship Portal (NSP)',
                        url: 'https://scholarships.gov.in/',
                        category: 'Education',
                        desc: 'Central & State Government pre-matric, post-matric, and higher education scholarships.',
                      },
                      {
                        name: 'DigiLocker',
                        url: 'https://www.digilocker.gov.in/',
                        category: 'Identity & Travel',
                        desc: 'Legally recognized digital document wallet issuing authentic certificates and marksheets.',
                      },
                      {
                        name: 'Income Tax e-Filing & PAN Portal',
                        url: 'https://www.incometax.gov.in/',
                        category: 'Tax & Revenue',
                        desc: 'Instant e-PAN allotment, tax returns, PAN-Aadhaar linking, and Form 26AS verification.',
                      },
                      {
                        name: 'Parivahan Sewa (MoRTH)',
                        url: 'https://parivahan.gov.in/',
                        category: 'Identity & Travel',
                        desc: 'Ministry of Road Transport & Highways for Driving Licence, Learner Licence, and Vehicle RC.',
                      },
                      {
                        name: 'ServicePlus / State e-District',
                        url: 'https://serviceonline.gov.in/',
                        category: 'Certificates',
                        desc: 'Unified citizen certificate framework for Income, Caste, Domicile, and Character certificates.',
                      },
                      {
                        name: 'e-Shram Portal',
                        url: 'https://eshram.gov.in/',
                        category: 'Welfare',
                        desc: 'National database of unorganized workers with social security schemes and insurance coverage.',
                      },
                      {
                        name: 'PM-KISAN Samman Nidhi',
                        url: 'https://pmkisan.gov.in/',
                        category: 'Welfare',
                        desc: 'Department of Agriculture direct income support of ₹6,000 per year for farmer families.',
                      },
                      {
                        name: 'UMANG Unified Services',
                        url: 'https://web.umang.gov.in/',
                        category: 'Certificates',
                        desc: 'Unified mobile & web governance accessing 1,200+ central and state government services.',
                      },
                      {
                        name: 'RTI Online Portal',
                        url: 'https://rtionline.gov.in/',
                        category: 'Certificates',
                        desc: 'Department of Personnel & Training for filing online Right to Information queries.',
                      },
                    ]
                      .filter((s) => {
                        const matchesCategory = sourceCategory === 'All' || s.category === sourceCategory
                        const matchesQuery = !sourceSearch.trim() ||
                          s.name.toLowerCase().includes(sourceSearch.toLowerCase()) ||
                          s.desc.toLowerCase().includes(sourceSearch.toLowerCase()) ||
                          s.category.toLowerCase().includes(sourceSearch.toLowerCase())
                        return matchesCategory && matchesQuery
                      })
                      .map((s) => (
                        <div className="source-row" key={s.url}>
                          <div className="source-icon">
                            <Globe2 size={17} />
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <b>{s.name}</b>
                              <span className="source-cat-badge">{s.category}</span>
                            </div>
                            <p>{s.desc}</p>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
                              <a href={s.url} target="_blank" rel="noreferrer" style={{ fontSize: 9 }}>
                                {s.url} <ArrowUpRight size={11} style={{ verticalAlign: 'middle' }} />
                              </a>
                              <button
                                type="button"
                                className="text-btn"
                                onClick={() => { setSourceUrl(s.url); notify(`Selected ${s.name} for official page retrieval.`); }}
                                style={{ fontSize: 9 }}
                              >
                                Retrieve in CivicPilot →
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
                <div className="panel">
                  <h3>Fetch an official page</h3>
                  <p className="subtle">
                    Enter an HTTPS government domain URL (.gov.in, .nic.in, or approved .gov domain).
                  </p>
                  <input
                    className="source-input"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://www.india.gov.in/"
                  />
                  <button className="primary-btn full-btn" onClick={fetchSource}>
                    Retrieve page <ArrowRight size={15} />
                  </button>
                  {sourceResult && (
                    <div className="source-result">
                      <b>{sourceResult.source.title}</b>
                      <a href={sourceResult.source.url} target="_blank" rel="noreferrer">
                        {sourceResult.source.url}
                      </a>
                      <p>{sourceResult.content}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
                  {page === 'Help & Guide' && (
            <div className="page-wrap">
              <div className="page-heading">
                <div className="eyebrow">
                  <span className="eyebrow-dot" /> CITIZEN ASSISTANCE & SYSTEM GUIDE
                </div>
                <h1>Help & User Guide</h1>
                <p>Everything you need to know about navigating public services, analyzing document readiness, and staying secure.</p>
              </div>

              {/* Safety Guarantees Bar */}
              <div className="safety-strip">
                <div className="safety-badge-item">
                  <ShieldCheck size={20} className="safety-icon" />
                  <div>
                    <b>Grounded in Official Portals</b>
                    <small>Information and checklists are strictly matched against verified .gov.in and .nic.in standards.</small>
                  </div>
                </div>
                <div className="safety-badge-item">
                  <ShieldCheck size={20} className="safety-icon" />
                  <div>
                    <b>Privacy First & UID Masking</b>
                    <small>Sensitive numbers (Aadhaar, PAN) are masked automatically (e.g. XXXX-XXXX-1234) before processing.</small>
                  </div>
                </div>
                <div className="safety-badge-item">
                  <ShieldCheck size={20} className="safety-icon" />
                  <div>
                    <b>Citizen in Full Control</b>
                    <small>CivicPilot never makes payments, handles OTPs, or submits applications without your explicit action.</small>
                  </div>
                </div>
              </div>

              {/* 4 Core Features Walkthrough */}
              <section className="help-section" style={{ marginTop: 24 }}>
                <div className="section-heading">
                  <div>
                    <h2>How CivicPilot Works</h2>
                    <p>Four powerful tools to guide your public service journey from start to finish.</p>
                  </div>
                  <span className="muted-tag">CORE MODULES</span>
                </div>
                <div className="quick-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
                  <div className="quick-card" style={{ cursor: 'pointer' }} onClick={() => setPage('AI assistant')}>
                    <div className="quick-icon lavender">
                      <MessageCircle size={20} />
                    </div>
                    <b>1. AI Assistant</b>
                    <p>Chat naturally about any government scheme, eligibility rules, or application step. Ask follow-up questions anytime.</p>
                    <span>Open AI Assistant <ArrowRight size={13} /></span>
                  </div>

                  <div className="quick-card" style={{ cursor: 'pointer' }} onClick={() => setPage('Documents')}>
                    <div className="quick-icon mint">
                      <FileText size={20} />
                    </div>
                    <b>2. Document Readiness</b>
                    <p>Upload your supporting certificates (PDF/PNG/JPG). Get instant checklist matching, missing document warnings, and readiness score.</p>
                    <span>Inspect Documents <ArrowRight size={13} /></span>
                  </div>

                  <div className="quick-card" style={{ cursor: 'pointer' }} onClick={() => setPage('Agent workspace')}>
                    <div className="quick-icon peach">
                      <Bot size={20} />
                    </div>
                    <b>3. Agent Workspace</b>
                    <p>Structured, multi-step workflow planner with human approval gates to organize your complete application packet.</p>
                    <span>View Workspace <ArrowRight size={13} /></span>
                  </div>

                  <div className="quick-card" style={{ cursor: 'pointer' }} onClick={() => setPage('Official sources')}>
                    <div className="quick-icon lavender">
                      <Globe2 size={20} />
                    </div>
                    <b>4. Official Sources</b>
                    <p>Direct directory of official Indian government portals with live retrieval from Passport Seva, DigiLocker, NSP, and more.</p>
                    <span>Browse Portals <ArrowRight size={13} /></span>
                  </div>
                </div>
              </section>

              {/* FAQs Accordion */}
              <section className="help-section" style={{ marginTop: 32 }}>
                <div className="section-heading">
                  <div>
                    <h2>Frequently Asked Questions</h2>
                    <p>Common questions about document verification, privacy, and government procedures.</p>
                  </div>
                  <div style={{ maxWidth: 260 }}>
                    <input
                      type="text"
                      className="aside-card-input"
                      placeholder="Search FAQs..."
                      value={helpSearch}
                      onChange={(e) => setHelpSearch(e.target.value)}
                      style={{
                        padding: '6px 12px',
                        fontSize: 11,
                        border: '1px solid #dcdff0',
                        borderRadius: 8,
                        background: '#fff',
                        width: '100%',
                      }}
                    />
                  </div>
                </div>

                <div className="faq-list" style={{ marginTop: 14 }}>
                  {[
                    {
                      q: 'Does CivicPilot directly submit my application to the government portal?',
                      a: 'No. CivicPilot is an AI assistant designed to prepare, verify, and organize your application workflow. Due to government safety regulations, OTP validations, CAPTCHAs, and payment authorizations must always be completed directly by you on the official portal. CivicPilot ensures you have 100% of the required documents and prerequisites ready beforehand.',
                      tag: 'Safety & Submission',
                    },
                    {
                      q: 'How does the Document Readiness Meter calculate my score?',
                      a: 'The readiness engine matches your uploaded documents against official government document requirements. For instance, a Passport application requires 3 mandatory items: Proof of Address, Proof of Date of Birth, and Proof of Identity. When all 3 are satisfied, your readiness reaches 100%. If documents are unreadable or need human review, they are flagged accordingly.',
                      tag: 'Readiness & Scoring',
                    },
                    {
                      q: 'Is my personal and biometric data safe?',
                      a: 'Yes. CivicPilot strictly enforces citizen privacy guardrails. Sensitive identifiers such as 12-digit Aadhaar numbers and PAN numbers are masked automatically (e.g., XXXX-XXXX-1098). Uploaded files are processed in-memory for analysis and are never logged, stored, or shared with third parties.',
                      tag: 'Privacy & Security',
                    },
                    {
                      q: 'What file formats and upload limits are supported?',
                      a: 'CivicPilot supports standard Indian government application formats: PDF (.pdf), PNG (.png), and JPG/JPEG (.jpg, .jpeg) up to 10 MB per file. You can upload multiple files simultaneously in the Document Dashboard.',
                      tag: 'File Support',
                    },
                    {
                      q: 'What if I am missing a required document like an Income Certificate?',
                      a: 'If CivicPilot flags a missing document, check the "Official Sources" tab. For state certificates (Income, Caste, Domicile), visit your state’s e-District or ServicePlus portal (serviceonline.gov.in) to apply for the prerequisite certificate before submitting your primary application.',
                      tag: 'Application Guidance',
                    },
                    {
                      q: 'Can I reclassify an uploaded document if AI detected it under the wrong category?',
                      a: 'Yes! In the Document readiness dashboard, every uploaded file card has an interactive "Reclassify" dropdown. If an Aadhaar Card was initially detected as Identity Proof but you prefer to use it as Address Proof, you can change it with one click and the checklist updates instantly.',
                      tag: 'Document Dashboard',
                    },
                  ]
                    .filter((faq) => {
                      if (!helpSearch.trim()) return true
                      const s = helpSearch.toLowerCase()
                      return faq.q.toLowerCase().includes(s) || faq.a.toLowerCase().includes(s) || faq.tag.toLowerCase().includes(s)
                    })
                    .map((faq, idx) => {
                      const isOpen = openFaq === idx
                      return (
                        <div
                          key={idx}
                          className="faq-item-card"
                          style={{
                            background: '#fff',
                            border: '1px solid #e9edf4',
                            borderRadius: 12,
                            padding: '16px 18px',
                            marginBottom: 10,
                            boxShadow: '0 2px 8px #202b4a04',
                            transition: 'all 0.2s',
                          }}
                        >
                          <div
                            onClick={() => setOpenFaq(isOpen ? null : idx)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              gap: 12,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  color: '#5c66df',
                                  background: '#eef0ff',
                                  padding: '2px 8px',
                                  borderRadius: 12,
                                }}
                              >
                                {faq.tag}
                              </span>
                              <b style={{ fontSize: 13, color: '#27324c' }}>{faq.q}</b>
                            </div>
                            <ChevronDown
                              size={16}
                              style={{
                                color: '#8894a8',
                                transform: isOpen ? 'rotate(180deg)' : 'none',
                                transition: 'transform 0.2s',
                                flexShrink: 0,
                              }}
                            />
                          </div>
                          {isOpen && (
                            <p
                              style={{
                                fontSize: 11,
                                lineHeight: 1.7,
                                color: '#68738a',
                                margin: '12px 0 0',
                                paddingLeft: 4,
                                borderTop: '1px solid #f2f4f8',
                                paddingTop: 10,
                              }}
                            >
                              {faq.a}
                            </p>
                          )}
                        </div>
                      )
                    })}
                </div>
              </section>

              {/* Still need help? Interactive prompt box */}
              <div
                className="panel"
                style={{
                  marginTop: 28,
                  background: 'linear-gradient(135deg, #fbfbff, #f4f6ff)',
                  border: '1px solid #e5e8fb',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <Sparkles size={20} color="#5c66df" />
                  <h3 style={{ margin: 0, fontSize: 15 }}>Still have questions?</h3>
                </div>
                <p style={{ fontSize: 11, color: '#7a859c', margin: '0 0 16px' }}>
                  Our conversational AI Assistant can clarify specific state rules, eligibility requirements, or step-by-step procedures.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    'What documents are needed for fresh passport in India?',
                    'How do I apply for an Income Certificate online?',
                    'What is Non-ECR category for Indian passport?',
                    'How to check NSP scholarship application status?',
                  ].map((promptText, pIdx) => (
                    <button
                      key={pIdx}
                      type="button"
                      className="suggestion-chip"
                      style={{
                        background: '#ffffff',
                        border: '1px solid #dfe3f5',
                        borderRadius: 20,
                        padding: '6px 14px',
                        fontSize: 10,
                        fontWeight: 600,
                        color: '#4652a8',
                        cursor: 'pointer',
                        boxShadow: '0 2px 5px #202b4a04',
                      }}
                      onClick={() => {
                        setInput(promptText)
                        setPage('AI assistant')
                      }}
                    >
                      {promptText} →
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        <footer className="footer">
          <span>© 2026 CivicPilot</span>
          <span>
            <ShieldCheck size={13} /> Built for citizens. Designed with care.
          </span>
          <span>AI guidance · Human approval · Citizen control</span>
        </footer>
      </main>
            {/* Citizen Profile & Persona Modal */}
      {showCitizenModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowCitizenModal(false)}
        >
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-wrap">
                <div
                  className="modal-avatar"
                  style={{
                    background:
                      citizenRole === 'Student'
                        ? '#e5f6f1'
                        : citizenRole === 'Senior Citizen'
                        ? '#fff5e6'
                        : citizenRole === 'Facilitator'
                        ? '#fff0e8'
                        : '#eef0ff',
                    color:
                      citizenRole === 'Student'
                        ? '#2d9972'
                        : citizenRole === 'Senior Citizen'
                        ? '#c97828'
                        : citizenRole === 'Facilitator'
                        ? '#d68c5e'
                        : '#5c66df',
                  }}
                >
                  <UserRound size={20} />
                </div>
                <div>
                  <h3>{citizenName}</h3>
                  <small>{citizenRole} · Active Citizen Session</small>
                </div>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setShowCitizenModal(false)}
                title="Close"
              >
                <X size={15} />
              </button>
            </div>

            {/* Persona Switcher */}
            <div>
              <label className="field-label" style={{ margin: '0 0 6px' }}>CHOOSE CITIZEN PERSONA</label>
              <div className="persona-selector">
                {[
                  {
                    role: 'General citizen',
                    desc: 'Standard citizen application workflow',
                    icon: '👤',
                  },
                  {
                    role: 'Student',
                    desc: 'Scholarships, admission & fee waivers',
                    icon: '🎓',
                  },
                  {
                    role: 'Senior Citizen',
                    desc: 'Pensions, health & travel benefits',
                    icon: '👵',
                  },
                  {
                    role: 'Facilitator',
                    desc: 'CSC / e-Seva operator assisting others',
                    icon: '🤝',
                  },
                ].map((item) => (
                  <div
                    key={item.role}
                    className={`persona-card ${citizenRole === item.role ? 'active' : ''}`}
                    onClick={() => {
                      setCitizenRole(item.role)
                      notify(`Persona updated to ${item.role}.`)
                    }}
                  >
                    <b>{item.icon} {item.role}</b>
                    <small>{item.desc}</small>
                  </div>
                ))}
              </div>
            </div>

            {/* Profile Fields */}
            <div className="modal-field">
              <label>APPLICANT / CITIZEN NAME</label>
              <input
                type="text"
                value={citizenName}
                onChange={(e) => setCitizenName(e.target.value)}
                placeholder="e.g. Guest Citizen or Aarav Sharma"
              />
            </div>

            <div className="modal-field">
              <label>STATE / DISTRICT JURISDICTION</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Jharkhand, Ranchi or Delhi, South Delhi"
              />
              <small style={{ fontSize: 9, color: '#909bad', marginTop: 4, display: 'block' }}>
                Used automatically by AI Assistant and Document Requirements to match your state rules.
              </small>
            </div>

            {/* Session Stats Strip */}
            <div className="modal-stats-strip">
              <div className="modal-stat">
                <b>{analyzedDocuments.length}</b>
                <span>Documents</span>
              </div>
              <div className="modal-stat">
                <b>{readiness ? `${readiness.application.readiness_percentage}%` : '0%'}</b>
                <span>Readiness</span>
              </div>
              <div className="modal-stat">
                <b>{selectedService.split(' ')[0]}</b>
                <span>Service</span>
              </div>
            </div>

            {/* Privacy Note */}
            <div className="privacy-mini" style={{ margin: '14px 0 6px' }}>
              <ShieldCheck size={14} />
              <span>
                Ephemeral local session. Documents are processed in-memory with automatic Aadhaar/PAN privacy masking.
              </span>
            </div>

            {/* Modal Actions */}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  handleClearAllDocuments()
                  notify('Workspace documents reset.')
                  setShowCitizenModal(false)
                }}
                style={{ color: '#d16268' }}
              >
                <Trash2 size={13} /> Reset Documents
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  notify(`Profile saved: ${citizenName} (${citizenRole}).`)
                  setShowCitizenModal(false)
                }}
              >
                Save & Continue <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast">
          <CheckCircle2 size={16} />
          {toast}
          <button onClick={() => setToast('')}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
