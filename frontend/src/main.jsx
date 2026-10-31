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
      ],
    },
  ]

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <ShieldCheck size={21} />
          </div>
          <div>
            <b>civicpilot</b>
            <span>PUBLIC SERVICES, SIMPLIFIED</span>
          </div>
          <button className="mobile-close" onClick={() => setMobileNav(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="workspace-switch">
          <div className="workspace-avatar">CP</div>
          <div>
            <b>Citizen workspace</b>
            <small>Personal account</small>
          </div>
          <ChevronDown size={15} />
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
            <button onClick={() => setPage('AI assistant')}>
              Ask CivicPilot <ArrowRight size={14} />
            </button>
          </div>
          <div className="profile">
            <div className="profile-avatar">
              <UserRound size={17} />
            </div>
            <div>
              <b>Guest citizen</b>
              <small>Local session</small>
            </div>
            <MoreHorizontal size={18} />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setMobileNav(true)}>
            <Menu />
          </button>
          <div className="breadcrumb">
            Workspace <span>/</span> <b>{page}</b>
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
            <button className="icon-btn" title="Help">
              <CircleHelp size={18} />
            </button>
            <div className="top-avatar">G</div>
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
                  <div className="hero-card">
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
                    <MoreHorizontal size={18} />
                  </div>
                  <div className="status-row">
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
                  </div>
                  <div className="status-row">
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
                          <button
                            className="upload-btn-secondary"
                            onClick={handleClearAllDocuments}
                            style={{ color: '#c93b3b' }}
                          >
                            <Trash2 size={12} /> Clear all
                          </button>
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
                  <h3>Suggested official portals</h3>
                  {[
                    {
                      name: 'National Portal of India',
                      url: 'https://www.india.gov.in/',
                      desc: 'National government information and services.',
                    },
                    {
                      name: 'National Scholarship Portal',
                      url: 'https://scholarships.gov.in/',
                      desc: 'Scholarship information and application portal.',
                    },
                    {
                      name: 'DigiLocker',
                      url: 'https://www.digilocker.gov.in/',
                      desc: 'Access to issued digital documents.',
                    },
                  ].map((s) => (
                    <div className="source-row" key={s.url}>
                      <div className="source-icon">
                        <Globe2 size={17} />
                      </div>
                      <div>
                        <b>{s.name}</b>
                        <p>{s.desc}</p>
                        <a href={s.url} target="_blank" rel="noreferrer">
                          {s.url}
                        </a>
                      </div>
                      <ArrowUpRight size={15} />
                    </div>
                  ))}
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
        </div>

        <footer className="footer">
          <span>© 2026 CivicPilot</span>
          <span>
            <ShieldCheck size={13} /> Built for citizens. Designed with care.
          </span>
          <span>AI guidance · Human approval · Citizen control</span>
        </footer>
      </main>
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
