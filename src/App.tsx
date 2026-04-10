import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type MemberRole = 'tenant' | 'owner'
type ExpenseCategory = 'Water' | 'Electricity' | 'Misc'
type NoticeTone = 'success' | 'error'
type Screen = 'home' | 'expenses' | 'settle' | 'summary' | 'house'
type Composer = 'expense' | 'settlement' | null

type Member = {
  id: string
  name: string
  role: MemberRole
}

type Expense = {
  id: string
  title: string
  amount: number
  paidByMemberId: string
  date: string
  category: ExpenseCategory
  splitAmongMemberIds: string[]
}

type Settlement = {
  id: string
  fromMemberId: string
  toMemberId: string
  amount: number
  date: string
}

type AppData = {
  houseName: string
  members: Member[]
  expenses: Expense[]
  settlements: Settlement[]
}

type Notice = {
  tone: NoticeTone
  text: string
} | null

type BalanceRow = {
  member: Member
  amount: number
  paid: number
  share: number
}

type SuggestedSettlement = {
  fromMember: Member
  toMember: Member
  amount: number
}

const STORAGE_KEY = 'splitnest:v1'
const CATEGORY_OPTIONS: ExpenseCategory[] = ['Water', 'Electricity', 'Misc']
const SCREEN_META: Array<{ id: Screen; label: string; short: string }> = [
  { id: 'home', label: 'Home', short: 'Overview' },
  { id: 'expenses', label: 'Expenses', short: 'Ledger' },
  { id: 'settle', label: 'Settle', short: 'Payback' },
  { id: 'summary', label: 'Summary', short: 'Month' },
  { id: 'house', label: 'House', short: 'People' },
]

const today = new Date().toISOString().slice(0, 10)
const currentMonth = new Date().toISOString().slice(0, 7)

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function loadAppData(): AppData {
  if (typeof window === 'undefined') {
    return { houseName: '', members: [], expenses: [], settlements: [] }
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return { houseName: '', members: [], expenses: [], settlements: [] }
    }

    const parsed = JSON.parse(raw) as Partial<AppData>
    const members = Array.isArray(parsed.members) ? parsed.members : []

    return {
      houseName: typeof parsed.houseName === 'string' ? parsed.houseName : '',
      members,
      expenses: Array.isArray(parsed.expenses)
        ? parsed.expenses.map((expense) => ({
            ...expense,
            splitAmongMemberIds:
              Array.isArray(expense.splitAmongMemberIds) &&
              expense.splitAmongMemberIds.length > 0
                ? expense.splitAmongMemberIds
                : members.map((member) => member.id),
          }))
        : [],
      settlements: Array.isArray(parsed.settlements) ? parsed.settlements : [],
    }
  } catch {
    return { houseName: '', members: [], expenses: [], settlements: [] }
  }
}

function buildSampleData(): AppData {
  const members: Member[] = [
    { id: createId('member'), name: 'Asha', role: 'tenant' },
    { id: createId('member'), name: 'Rohan', role: 'tenant' },
    { id: createId('member'), name: 'Mira', role: 'tenant' },
    { id: createId('member'), name: 'Mr. Shah', role: 'owner' },
  ]

  return {
    houseName: 'Palm Grove Flat',
    members,
    expenses: [
      {
        id: createId('expense'),
        title: 'Water Tanker',
        amount: 1600,
        paidByMemberId: members[0].id,
        date: `${currentMonth}-02`,
        category: 'Water',
        splitAmongMemberIds: members.map((member) => member.id),
      },
      {
        id: createId('expense'),
        title: 'Electricity Bill',
        amount: 2450,
        paidByMemberId: members[3].id,
        date: `${currentMonth}-05`,
        category: 'Electricity',
        splitAmongMemberIds: members.map((member) => member.id),
      },
      {
        id: createId('expense'),
        title: 'Cleaning Supplies',
        amount: 780,
        paidByMemberId: members[1].id,
        date: `${currentMonth}-07`,
        category: 'Misc',
        splitAmongMemberIds: members.map((member) => member.id),
      },
    ],
    settlements: [
      {
        id: createId('settlement'),
        fromMemberId: members[2].id,
        toMemberId: members[0].id,
        amount: 400,
        date: `${currentMonth}-08`,
      },
    ],
  }
}

function calculateBalances(data: AppData): BalanceRow[] {
  const balances = new Map<string, number>()
  const paidTotals = new Map<string, number>()
  const shareTotals = new Map<string, number>()

  data.members.forEach((member) => {
    balances.set(member.id, 0)
    paidTotals.set(member.id, 0)
    shareTotals.set(member.id, 0)
  })

  data.expenses.forEach((expense) => {
    const participantIds =
      expense.splitAmongMemberIds.length > 0
        ? expense.splitAmongMemberIds
        : data.members.map((member) => member.id)
    const share = expense.amount / participantIds.length

    balances.set(
      expense.paidByMemberId,
      (balances.get(expense.paidByMemberId) ?? 0) + expense.amount,
    )
    paidTotals.set(
      expense.paidByMemberId,
      (paidTotals.get(expense.paidByMemberId) ?? 0) + expense.amount,
    )

    participantIds.forEach((participantId) => {
      balances.set(participantId, (balances.get(participantId) ?? 0) - share)
      shareTotals.set(participantId, (shareTotals.get(participantId) ?? 0) + share)
    })
  })

  data.settlements.forEach((settlement) => {
    balances.set(
      settlement.fromMemberId,
      (balances.get(settlement.fromMemberId) ?? 0) + settlement.amount,
    )
    balances.set(
      settlement.toMemberId,
      (balances.get(settlement.toMemberId) ?? 0) - settlement.amount,
    )
  })

  return data.members.map((member) => ({
    member,
    amount: balances.get(member.id) ?? 0,
    paid: paidTotals.get(member.id) ?? 0,
    share: shareTotals.get(member.id) ?? 0,
  }))
}

function calculateSuggestedSettlements(rows: BalanceRow[]): SuggestedSettlement[] {
  const creditors = rows
    .filter((row) => row.amount > 0.01)
    .map((row) => ({ ...row }))
    .sort((a, b) => b.amount - a.amount)
  const debtors = rows
    .filter((row) => row.amount < -0.01)
    .map((row) => ({ ...row, amount: Math.abs(row.amount) }))
    .sort((a, b) => b.amount - a.amount)
  const suggestions: SuggestedSettlement[] = []

  let creditorIndex = 0
  let debtorIndex = 0

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex]
    const debtor = debtors[debtorIndex]
    const amount = Math.min(creditor.amount, debtor.amount)

    suggestions.push({
      fromMember: debtor.member,
      toMember: creditor.member,
      amount,
    })

    creditor.amount -= amount
    debtor.amount -= amount

    if (creditor.amount <= 0.01) {
      creditorIndex += 1
    }

    if (debtor.amount <= 0.01) {
      debtorIndex += 1
    }
  }

  return suggestions
}

function getMonthlySummary(data: AppData, month: string) {
  const monthlyExpenses = data.expenses.filter((expense) => expense.date.startsWith(month))
  const monthlySettlements = data.settlements.filter((settlement) =>
    settlement.date.startsWith(month),
  )

  const monthlyData: AppData = {
    houseName: data.houseName,
    members: data.members,
    expenses: monthlyExpenses,
    settlements: monthlySettlements,
  }

  const balances = calculateBalances(monthlyData)
  const totalExpenses = monthlyExpenses.reduce((sum, expense) => sum + expense.amount, 0)
  const categories = CATEGORY_OPTIONS.map((category) => ({
    category,
    total: monthlyExpenses
      .filter((expense) => expense.category === category)
      .reduce((sum, expense) => sum + expense.amount, 0),
  })).filter((row) => row.total > 0)

  return {
    month,
    totalExpenses,
    expensesCount: monthlyExpenses.length,
    settlementsCount: monthlySettlements.length,
    balances,
    categories,
  }
}

function getMemberName(members: Member[], memberId: string) {
  return members.find((member) => member.id === memberId)?.name ?? 'Unknown'
}

function App() {
  const [data, setData] = useState<AppData>(() => loadAppData())
  const [notice, setNotice] = useState<Notice>(null)
  const [activeScreen, setActiveScreen] = useState<Screen>('home')
  const [activeComposer, setActiveComposer] = useState<Composer>(null)

  const [setupHouseName, setSetupHouseName] = useState('')
  const [setupMemberName, setSetupMemberName] = useState('')
  const [setupMemberRole, setSetupMemberRole] = useState<MemberRole>('tenant')
  const [setupMembers, setSetupMembers] = useState<Member[]>([])

  const [memberName, setMemberName] = useState('')
  const [memberRole, setMemberRole] = useState<MemberRole>('tenant')

  const [expenseTitle, setExpenseTitle] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expensePaidBy, setExpensePaidBy] = useState('')
  const [expenseDate, setExpenseDate] = useState(today)
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>('Water')

  const [settlementFrom, setSettlementFrom] = useState('')
  const [settlementTo, setSettlementTo] = useState('')
  const [settlementAmount, setSettlementAmount] = useState('')
  const [settlementDate, setSettlementDate] = useState(today)

  const [historyMonthFilter, setHistoryMonthFilter] = useState(currentMonth)
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState<'All' | ExpenseCategory>(
    'All',
  )
  const [historyMemberFilter, setHistoryMemberFilter] = useState('all')
  const [summaryMonth, setSummaryMonth] = useState(currentMonth)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  useEffect(() => {
    if (!notice) {
      return undefined
    }

    const timeout = window.setTimeout(() => setNotice(null), 2600)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const balances = calculateBalances(data)
  const suggestedSettlements = calculateSuggestedSettlements(balances)
  const totalExpenses = data.expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const pendingAmount = balances
    .filter((row) => row.amount < -0.01)
    .reduce((sum, row) => sum + Math.abs(row.amount), 0) / 2
  const settledAmount = data.settlements.reduce((sum, settlement) => sum + settlement.amount, 0)
  const monthlySummary = getMonthlySummary(data, summaryMonth)
  const selectedExpensePayer = expensePaidBy || data.members[0]?.id || ''
  const selectedSettlementFrom = settlementFrom || data.members[0]?.id || ''
  const selectedSettlementTo =
    settlementTo || data.members[1]?.id || data.members[0]?.id || ''
  const primaryUser = data.members[0]
  const primaryUserBalance = balances.find((row) => row.member.id === primaryUser?.id)?.amount ?? 0

  const filteredExpenses = data.expenses
    .filter((expense) => {
      const matchesMonth = historyMonthFilter
        ? expense.date.startsWith(historyMonthFilter)
        : true
      const matchesCategory =
        historyCategoryFilter === 'All' || expense.category === historyCategoryFilter
      const matchesMember =
        historyMemberFilter === 'all' || expense.paidByMemberId === historyMemberFilter

      return matchesMonth && matchesCategory && matchesMember
    })
    .sort((left, right) => right.date.localeCompare(left.date))

  const recentExpenses = [...data.expenses]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 4)

  const recentSettlements = [...data.settlements]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 4)

  function showMessage(tone: NoticeTone, text: string) {
    setNotice({ tone, text })
  }

  function openComposer(composer: Composer, screen?: Screen) {
    if (screen) {
      setActiveScreen(screen)
    }
    setActiveComposer(composer)
  }

  function closeComposer() {
    setActiveComposer(null)
  }

  function addSetupMember() {
    if (!setupMemberName.trim()) {
      showMessage('error', 'Enter a member name before adding them.')
      return
    }

    setSetupMembers((current) => [
      ...current,
      {
        id: createId('member'),
        name: setupMemberName.trim(),
        role: setupMemberRole,
      },
    ])
    setSetupMemberName('')
  }

  function createHousehold(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!setupHouseName.trim()) {
      showMessage('error', 'Choose a house name first.')
      return
    }

    if (setupMembers.length < 2) {
      showMessage('error', 'Add at least two members to start splitting expenses.')
      return
    }

    setData({
      houseName: setupHouseName.trim(),
      members: setupMembers,
      expenses: [],
      settlements: [],
    })
    setActiveScreen('home')
    showMessage('success', 'Household created. You can start logging expenses now.')
  }

  function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!memberName.trim()) {
      showMessage('error', 'Enter a member name before saving.')
      return
    }

    setData((current) => ({
      ...current,
      members: [
        ...current.members,
        {
          id: createId('member'),
          name: memberName.trim(),
          role: memberRole,
        },
      ],
    }))
    setMemberName('')
    showMessage('success', 'Member added. Future expenses will include them automatically.')
  }

  function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedAmount = Number.parseFloat(expenseAmount)

    if (
      !expenseTitle.trim() ||
      !selectedExpensePayer ||
      Number.isNaN(parsedAmount) ||
      parsedAmount <= 0
    ) {
      showMessage('error', 'Fill in the title, payer, and a valid amount.')
      return
    }

    setData((current) => ({
      ...current,
      expenses: [
        {
          id: createId('expense'),
          title: expenseTitle.trim(),
          amount: parsedAmount,
          paidByMemberId: selectedExpensePayer,
          date: expenseDate,
          category: expenseCategory,
          splitAmongMemberIds: current.members.map((member) => member.id),
        },
        ...current.expenses,
      ],
    }))
    setExpenseTitle('')
    setExpenseAmount('')
    setExpenseCategory('Water')
    closeComposer()
    setActiveScreen('expenses')
    showMessage('success', 'Expense saved and split equally across the house.')
  }

  function addSettlement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedAmount = Number.parseFloat(settlementAmount)

    if (
      !selectedSettlementFrom ||
      !selectedSettlementTo ||
      selectedSettlementFrom === selectedSettlementTo ||
      Number.isNaN(parsedAmount) ||
      parsedAmount <= 0
    ) {
      showMessage('error', 'Choose two different members and enter a valid amount.')
      return
    }

    setData((current) => ({
      ...current,
      settlements: [
        {
          id: createId('settlement'),
          fromMemberId: selectedSettlementFrom,
          toMemberId: selectedSettlementTo,
          amount: parsedAmount,
          date: settlementDate,
        },
        ...current.settlements,
      ],
    }))
    setSettlementAmount('')
    closeComposer()
    setActiveScreen('settle')
    showMessage('success', 'Settlement recorded and balances updated.')
  }

  function applySuggestedSettlement(item: SuggestedSettlement) {
    setSettlementFrom(item.fromMember.id)
    setSettlementTo(item.toMember.id)
    setSettlementAmount(item.amount.toFixed(2))
    setSettlementDate(today)
    openComposer('settlement', 'settle')
  }

  function loadDemoData() {
    setData(buildSampleData())
    setActiveScreen('home')
    setNotice({
      tone: 'success',
      text: 'Demo household loaded so you can explore the app flow immediately.',
    })
  }

  function resetAllData() {
    if (
      !window.confirm(
        'This clears the household, expenses, and settlements stored on this device.',
      )
    ) {
      return
    }

    const emptyState = { houseName: '', members: [], expenses: [], settlements: [] }
    setData(emptyState)
    setSetupHouseName('')
    setSetupMemberName('')
    setSetupMembers([])
    setActiveComposer(null)
    setActiveScreen('home')
    window.localStorage.removeItem(STORAGE_KEY)
    showMessage('success', 'Local data cleared.')
  }

  function renderHomeScreen() {
    return (
      <section className="screen-stack">
        <article className="hero-panel">
          <div className="hero-copy-block">
            <p className="eyebrow">Today in {data.houseName}</p>
            <h1>
              {primaryUserBalance < -0.01
                ? `You owe ${formatCurrency(Math.abs(primaryUserBalance))}`
                : primaryUserBalance > 0.01
                  ? `You are owed ${formatCurrency(primaryUserBalance)}`
                  : 'You are settled up'}
            </h1>
            <p className="hero-subtext">
              Quick view for {primaryUser?.name ?? 'your house'}. Add bills fast, see who
              owes what, and close the loop without digging through numbers.
            </p>
          </div>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => openComposer('expense')}>
              Add expense
            </button>
            <button className="ghost-button" onClick={() => openComposer('settlement')}>
              Record payment
            </button>
          </div>
        </article>

        <div className="overview-grid">
          <article className="mini-panel">
            <span>Total tracked</span>
            <strong>{formatCurrency(totalExpenses)}</strong>
          </article>
          <article className="mini-panel">
            <span>This month</span>
            <strong>{formatCurrency(monthlySummary.totalExpenses)}</strong>
          </article>
          <article className="mini-panel">
            <span>Pending</span>
            <strong>{formatCurrency(pendingAmount)}</strong>
          </article>
          <article className="mini-panel">
            <span>Settled so far</span>
            <strong>{formatCurrency(settledAmount)}</strong>
          </article>
        </div>

        <article className="content-panel">
          <div className="section-head">
            <div>
              <p className="panel-kicker">Quick settle</p>
              <h2>Suggested paybacks</h2>
            </div>
            <button className="text-button" onClick={() => setActiveScreen('settle')}>
              Open settle screen
            </button>
          </div>

          {suggestedSettlements.length > 0 ? (
            <div className="feed-list">
              {suggestedSettlements.slice(0, 3).map((item, index) => (
                <button
                  className="feed-card feed-card--action"
                  key={`${item.fromMember.id}-${item.toMember.id}-${index}`}
                  onClick={() => applySuggestedSettlement(item)}
                >
                  <div>
                    <h3>{item.fromMember.name}</h3>
                    <p>Pays {item.toMember.name}</p>
                  </div>
                  <strong>{formatCurrency(item.amount)}</strong>
                </button>
              ))}
            </div>
          ) : (
            <p className="empty-state">No paybacks needed right now.</p>
          )}
        </article>

        <article className="content-panel">
          <div className="section-head">
            <div>
              <p className="panel-kicker">Latest activity</p>
              <h2>Recent expenses</h2>
            </div>
            <button className="text-button" onClick={() => setActiveScreen('expenses')}>
              View all
            </button>
          </div>

          {recentExpenses.length > 0 ? (
            <div className="feed-list">
              {recentExpenses.map((expense) => (
                <div className="feed-card" key={expense.id}>
                  <div>
                    <h3>{expense.title}</h3>
                    <p>
                      {expense.date} · {expense.category} · Paid by{' '}
                      {getMemberName(data.members, expense.paidByMemberId)}
                    </p>
                  </div>
                  <strong>{formatCurrency(expense.amount)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No expenses yet. Start with your first bill.</p>
          )}
        </article>
      </section>
    )
  }

  function renderExpensesScreen() {
    return (
      <section className="screen-stack">
        <article className="content-panel">
          <div className="section-head">
            <div>
              <p className="panel-kicker">Ledger</p>
              <h2>Expenses</h2>
            </div>
            <button className="primary-button primary-button--compact" onClick={() => openComposer('expense')}>
              Add expense
            </button>
          </div>

          <div className="filter-grid">
            <label className="field">
              <span>Month</span>
              <input
                type="month"
                value={historyMonthFilter}
                onChange={(event) => setHistoryMonthFilter(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Category</span>
              <select
                value={historyCategoryFilter}
                onChange={(event) =>
                  setHistoryCategoryFilter(event.target.value as 'All' | ExpenseCategory)
                }
              >
                <option value="All">All</option>
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Payer</span>
              <select
                value={historyMemberFilter}
                onChange={(event) => setHistoryMemberFilter(event.target.value)}
              >
                <option value="all">Everyone</option>
                {data.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {filteredExpenses.length > 0 ? (
            <div className="feed-list">
              {filteredExpenses.map((expense) => (
                <div className="feed-card" key={expense.id}>
                  <div>
                    <h3>{expense.title}</h3>
                    <p>
                      {expense.date} · {expense.category} · Paid by{' '}
                      {getMemberName(data.members, expense.paidByMemberId)}
                    </p>
                  </div>
                  <div className="feed-meta">
                    <strong>{formatCurrency(expense.amount)}</strong>
                    <span>
                      {formatCurrency(expense.amount / expense.splitAmongMemberIds.length)} per person
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No expenses match this filter yet.</p>
          )}
        </article>
      </section>
    )
  }

  function renderSettleScreen() {
    return (
      <section className="screen-stack">
        <article className="content-panel">
          <div className="section-head">
            <div>
              <p className="panel-kicker">Who should pay now</p>
              <h2>Settle up</h2>
            </div>
            <button className="primary-button primary-button--compact" onClick={() => openComposer('settlement')}>
              Record payment
            </button>
          </div>

          {suggestedSettlements.length > 0 ? (
            <div className="feed-list">
              {suggestedSettlements.map((item, index) => (
                <button
                  className="feed-card feed-card--action"
                  key={`${item.fromMember.id}-${item.toMember.id}-${index}`}
                  onClick={() => applySuggestedSettlement(item)}
                >
                  <div>
                    <h3>{item.fromMember.name}</h3>
                    <p>Settle with {item.toMember.name}</p>
                  </div>
                  <strong>{formatCurrency(item.amount)}</strong>
                </button>
              ))}
            </div>
          ) : (
            <p className="empty-state">Everyone looks settled. Nice.</p>
          )}
        </article>

        <article className="content-panel">
          <div className="section-head">
            <div>
              <p className="panel-kicker">Recorded recently</p>
              <h2>Recent settlements</h2>
            </div>
          </div>

          {recentSettlements.length > 0 ? (
            <div className="feed-list">
              {recentSettlements.map((settlement) => (
                <div className="feed-card" key={settlement.id}>
                  <div>
                    <h3>{formatCurrency(settlement.amount)}</h3>
                    <p>
                      {getMemberName(data.members, settlement.fromMemberId)} paid{' '}
                      {getMemberName(data.members, settlement.toMemberId)}
                    </p>
                  </div>
                  <span className="pill">{settlement.date}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No settlements recorded yet.</p>
          )}
        </article>
      </section>
    )
  }

  function renderSummaryScreen() {
    return (
      <section className="screen-stack">
        <article className="content-panel">
          <div className="section-head">
            <div>
              <p className="panel-kicker">Month at a glance</p>
              <h2>Summary</h2>
            </div>
          </div>

          <label className="field">
            <span>Month</span>
            <input
              type="month"
              value={summaryMonth}
              onChange={(event) => setSummaryMonth(event.target.value)}
            />
          </label>

          <div className="overview-grid overview-grid--tight">
            <article className="mini-panel">
              <span>Total expenses</span>
              <strong>{formatCurrency(monthlySummary.totalExpenses)}</strong>
            </article>
            <article className="mini-panel">
              <span>Expenses</span>
              <strong>{monthlySummary.expensesCount}</strong>
            </article>
            <article className="mini-panel">
              <span>Settlements</span>
              <strong>{monthlySummary.settlementsCount}</strong>
            </article>
          </div>
        </article>

        <article className="content-panel">
          <div className="section-head">
            <div>
              <p className="panel-kicker">Where the money went</p>
              <h2>By category</h2>
            </div>
          </div>
          {monthlySummary.categories.length > 0 ? (
            <div className="line-list">
              {monthlySummary.categories.map((row) => (
                <div className="line-row" key={row.category}>
                  <span>{row.category}</span>
                  <strong>{formatCurrency(row.total)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No expenses logged for this month.</p>
          )}
        </article>

        <article className="content-panel">
          <div className="section-head">
            <div>
              <p className="panel-kicker">Per person</p>
              <h2>Positions</h2>
            </div>
          </div>
          <div className="line-list">
            {monthlySummary.balances.map((row) => (
              <div className="line-row" key={row.member.id}>
                <span>{row.member.name}</span>
                <strong className={row.amount >= 0 ? 'positive' : 'negative'}>
                  {row.amount >= 0 ? '+' : '-'}
                  {formatCurrency(Math.abs(row.amount))}
                </strong>
              </div>
            ))}
          </div>
        </article>
      </section>
    )
  }

  function renderHouseScreen() {
    return (
      <section className="screen-stack">
        <article className="content-panel">
          <div className="section-head">
            <div>
              <p className="panel-kicker">Your household</p>
              <h2>{data.houseName}</h2>
            </div>
            <span className="pill">{data.members.length} members</span>
          </div>

          <div className="member-list">
            {data.members.map((member) => (
              <div className="member-row-card" key={member.id}>
                <div>
                  <h3>{member.name}</h3>
                  <p>{member.role === 'owner' ? 'Owner' : 'Tenant'}</p>
                </div>
                <strong>{formatCurrency(balances.find((row) => row.member.id === member.id)?.amount ?? 0)}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="content-panel">
          <div className="section-head">
            <div>
              <p className="panel-kicker">Add someone new</p>
              <h2>Members</h2>
            </div>
          </div>

          <form className="stack" onSubmit={addMember}>
            <label className="field">
              <span>Name</span>
              <input
                value={memberName}
                onChange={(event) => setMemberName(event.target.value)}
                placeholder="New tenant"
              />
            </label>

            <label className="field">
              <span>Role</span>
              <select
                value={memberRole}
                onChange={(event) => setMemberRole(event.target.value as MemberRole)}
              >
                <option value="tenant">Tenant</option>
                <option value="owner">Owner</option>
              </select>
            </label>

            <button className="ghost-button" type="submit">
              Add member
            </button>
          </form>
        </article>

        <article className="content-panel">
          <div className="section-head">
            <div>
              <p className="panel-kicker">Device storage</p>
              <h2>Local-first for now</h2>
            </div>
          </div>

          <p className="body-copy">
            This version keeps the house ledger on this device so it feels instant and
            works offline. We can add Cloudflare or Firebase sync next.
          </p>

          <button className="ghost-button ghost-button--warn" onClick={resetAllData}>
            Reset local data
          </button>
        </article>
      </section>
    )
  }

  function renderActiveScreen() {
    switch (activeScreen) {
      case 'expenses':
        return renderExpensesScreen()
      case 'settle':
        return renderSettleScreen()
      case 'summary':
        return renderSummaryScreen()
      case 'house':
        return renderHouseScreen()
      case 'home':
      default:
        return renderHomeScreen()
    }
  }

  if (data.members.length === 0) {
    return (
      <div className="app-shell app-shell--setup">
        <section className="setup-shell">
          <article className="hero-panel hero-panel--setup">
            <div className="hero-copy-block">
              <p className="eyebrow">SplitNest</p>
              <h1>Set up your shared house in under a minute.</h1>
              <p className="hero-subtext">
                Start with a house name, add at least two people, and the app is ready
                to split bills immediately.
              </p>
            </div>
            <button className="ghost-button" onClick={loadDemoData}>
              Load demo household
            </button>
          </article>

          {notice ? (
            <div className={`notice notice--${notice.tone}`} role="status">
              {notice.text}
            </div>
          ) : null}

          <article className="content-panel">
            <form className="stack" onSubmit={createHousehold}>
              <label className="field">
                <span>House name</span>
                <input
                  value={setupHouseName}
                  onChange={(event) => setSetupHouseName(event.target.value)}
                  placeholder="Green Meadows Flat"
                />
              </label>

              <div className="setup-composer">
                <label className="field">
                  <span>Member name</span>
                  <input
                    value={setupMemberName}
                    onChange={(event) => setSetupMemberName(event.target.value)}
                    placeholder="Priya"
                  />
                </label>

                <label className="field">
                  <span>Role</span>
                  <select
                    value={setupMemberRole}
                    onChange={(event) => setSetupMemberRole(event.target.value as MemberRole)}
                  >
                    <option value="tenant">Tenant</option>
                    <option value="owner">Owner</option>
                  </select>
                </label>

                <button className="secondary-button" type="button" onClick={addSetupMember}>
                  Add member
                </button>
              </div>

              <div className="member-strip">
                {setupMembers.map((member) => (
                  <span className="member-chip" key={member.id}>
                    {member.name}
                    <em>{member.role}</em>
                  </span>
                ))}
              </div>

              <button className="primary-button" type="submit">
                Create household
              </button>
            </form>
          </article>
        </section>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="device-frame">
        <header className="topbar">
          <div>
            <p className="eyebrow">{data.houseName}</p>
            <h2>{SCREEN_META.find((screen) => screen.id === activeScreen)?.label}</h2>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" onClick={() => openComposer('expense')}>
              Add
            </button>
          </div>
        </header>

        {notice ? (
          <div className={`notice notice--${notice.tone}`} role="status">
            {notice.text}
          </div>
        ) : null}

        <main className="screen-stage">{renderActiveScreen()}</main>

        {(activeScreen === 'home' || activeScreen === 'expenses' || activeScreen === 'settle') && (
          <button
            className="floating-action"
            onClick={() =>
              openComposer(activeScreen === 'settle' ? 'settlement' : 'expense')
            }
          >
            {activeScreen === 'settle' ? 'Record payment' : 'Add expense'}
          </button>
        )}

        <nav className="bottom-nav" aria-label="Primary">
          {SCREEN_META.map((screen) => (
            <button
              key={screen.id}
              className={screen.id === activeScreen ? 'nav-item nav-item--active' : 'nav-item'}
              onClick={() => setActiveScreen(screen.id)}
            >
              <strong>{screen.label}</strong>
              <span>{screen.short}</span>
            </button>
          ))}
        </nav>
      </div>

      {activeComposer ? (
        <div className="sheet-backdrop" onClick={closeComposer} role="presentation">
          <section
            className="sheet"
            onClick={(event) => event.stopPropagation()}
            aria-label={activeComposer === 'expense' ? 'Add expense' : 'Record settlement'}
          >
            <div className="sheet-handle" />
            <div className="section-head">
              <div>
                <p className="panel-kicker">
                  {activeComposer === 'expense' ? 'Quick entry' : 'Quick settle'}
                </p>
                <h2>{activeComposer === 'expense' ? 'Add expense' : 'Record payment'}</h2>
              </div>
              <button className="text-button" onClick={closeComposer}>
                Close
              </button>
            </div>

            {activeComposer === 'expense' ? (
              <form className="stack" onSubmit={addExpense}>
                <label className="field">
                  <span>Title</span>
                  <input
                    value={expenseTitle}
                    onChange={(event) => setExpenseTitle(event.target.value)}
                    placeholder="Water bill"
                  />
                </label>

                <label className="field">
                  <span>Amount</span>
                  <input
                    inputMode="decimal"
                    value={expenseAmount}
                    onChange={(event) => setExpenseAmount(event.target.value)}
                    placeholder="1600"
                  />
                </label>

                <div className="split-fields">
                  <label className="field">
                    <span>Paid by</span>
                    <select
                      value={selectedExpensePayer}
                      onChange={(event) => setExpensePaidBy(event.target.value)}
                    >
                      {data.members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Category</span>
                    <select
                      value={expenseCategory}
                      onChange={(event) =>
                        setExpenseCategory(event.target.value as ExpenseCategory)
                      }
                    >
                      {CATEGORY_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="field">
                  <span>Date</span>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(event) => setExpenseDate(event.target.value)}
                  />
                </label>

                <button className="primary-button" type="submit">
                  Save expense
                </button>
              </form>
            ) : (
              <form className="stack" onSubmit={addSettlement}>
                <div className="split-fields">
                  <label className="field">
                    <span>Who paid</span>
                    <select
                      value={selectedSettlementFrom}
                      onChange={(event) => setSettlementFrom(event.target.value)}
                    >
                      {data.members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Paid to</span>
                    <select
                      value={selectedSettlementTo}
                      onChange={(event) => setSettlementTo(event.target.value)}
                    >
                      {data.members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="field">
                  <span>Amount</span>
                  <input
                    inputMode="decimal"
                    value={settlementAmount}
                    onChange={(event) => setSettlementAmount(event.target.value)}
                    placeholder="500"
                  />
                </label>

                <label className="field">
                  <span>Date</span>
                  <input
                    type="date"
                    value={settlementDate}
                    onChange={(event) => setSettlementDate(event.target.value)}
                  />
                </label>

                <button className="primary-button" type="submit">
                  Record payment
                </button>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </div>
  )
}

export default App
