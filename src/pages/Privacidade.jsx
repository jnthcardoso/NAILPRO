import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Lock } from 'lucide-react'

export default function Privacidade() {
  const navigate = useNavigate()
  return (
    <div style={s.page}>
      <div style={s.container}>
        <button style={s.voltarBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> Voltar
        </button>

        <div style={s.header}>
          <div style={s.icon}><Lock size={26} color="white" /></div>
          <h1 style={s.titulo}>Política de Privacidade</h1>
          <p style={s.versao}>Atualizado em 4 de Junho de 2026 · Em conformidade com a LGPD (Lei 13.709/18)</p>
        </div>

        <div style={s.conteudo}>

          <h2 style={s.h2}>1. Quem somos</h2>
          <p>A Lumen é uma plataforma de gestão para profissionais de manicure. Esta política descreve como coletamos, usamos e protegemos seus dados pessoais e os de suas clientes, em conformidade com a <strong>Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)</strong>.</p>

          <h2 style={s.h2}>2. Dados que coletamos</h2>

          <h3 style={s.h3}>2.1. Sobre você (profissional)</h3>
          <ul style={s.lista}>
            <li><strong>Cadastro:</strong> nome, e-mail, senha (criptografada);</li>
            <li><strong>Perfil:</strong> nome do salão, WhatsApp, foto de perfil (opcional);</li>
            <li><strong>Uso:</strong> data/hora de login, ações realizadas no app;</li>
            <li><strong>Pagamento:</strong> a Lumen <strong>não armazena os dados do seu cartão</strong>. As cobranças no cartão de crédito são processadas por gateway de pagamento (Asaas), que trata esses dados com segurança.</li>
          </ul>

          <h3 style={s.h3}>2.2. Sobre suas clientes (cadastradas por você)</h3>
          <ul style={s.lista}>
            <li>Nome, WhatsApp, e-mail (opcional);</li>
            <li>Data de nascimento (opcional, para alertas de aniversário);</li>
            <li>Histórico de atendimentos, valores e observações que você inserir.</li>
          </ul>
          <p style={s.aviso}><strong>⚠ Importante:</strong> Você é o controlador desses dados (LGPD Art. 5º, VI). A Lumen atua como operadora, processando-os em seu nome para fornecer o serviço.</p>

          <h2 style={s.h2}>3. Por que coletamos</h2>
          <p>Tratamos seus dados com base nas seguintes finalidades e bases legais (LGPD Art. 7º):</p>
          <ul style={s.lista}>
            <li><strong>Execução de contrato:</strong> fornecer o serviço contratado (gestão de agenda, clientes, etc);</li>
            <li><strong>Legítimo interesse:</strong> melhorias do produto, prevenção de fraude;</li>
            <li><strong>Cumprimento legal:</strong> obrigações fiscais e regulatórias;</li>
            <li><strong>Consentimento:</strong> envio de comunicações de marketing (opt-in).</li>
          </ul>

          <h2 style={s.h2}>4. Com quem compartilhamos</h2>
          <p>Não vendemos nem compartilhamos seus dados para fins comerciais. Compartilhamos apenas com:</p>
          <ul style={s.lista}>
            <li><strong>Supabase</strong> (infraestrutura de banco de dados e autenticação) — opera em conformidade com GDPR/LGPD;</li>
            <li><strong>Vercel</strong> (hospedagem do app);</li>
            <li><strong>Asaas</strong> (processamento de pagamentos no cartão de crédito);</li>
            <li><strong>Google Calendar</strong> e <strong>WhatsApp</strong> — apenas se você ativar as integrações.</li>
            <li><strong>Autoridades</strong>, quando legalmente exigido (ordem judicial).</li>
          </ul>

          <h3 style={s.h3}>4.1. Integração com o Google (Uso Limitado)</h3>
          <p>Se você conectar o <strong>Google Agenda</strong>, a Lumen solicita acesso apenas ao escopo <code>calendar.events</code>, usado <strong>exclusivamente</strong> para criar, atualizar e excluir no seu Google Agenda os eventos correspondentes aos agendamentos que você registra no app.</p>
          <p style={s.aviso}><strong>Uso Limitado (Limited Use):</strong> o uso e a transferência, pela Lumen, de informações recebidas das APIs do Google obedecem à <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer" style={s.link}>Política de Dados do Usuário dos Serviços de API do Google</a>, incluindo os requisitos de <strong>Uso Limitado</strong>. A Lumen <strong>não</strong> usa esses dados para publicidade, <strong>não</strong> os vende e <strong>não</strong> os compartilha com terceiros — exceto para fornecer ou melhorar a funcionalidade visível a você, cumprir a lei, ou mediante seu consentimento. Você pode revogar o acesso a qualquer momento em Configurações › Integrações, ou na sua <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" style={s.link}>conta Google</a>.</p>

          <h2 style={s.h2}>5. Cookies e tecnologias similares</h2>
          <p>Usamos cookies essenciais para manter sua sessão logada. Não utilizamos cookies de rastreamento de terceiros para publicidade.</p>

          <h2 style={s.h2}>6. Por quanto tempo guardamos</h2>
          <ul style={s.lista}>
            <li><strong>Conta ativa:</strong> enquanto sua assinatura estiver vigente;</li>
            <li><strong>Após cancelamento:</strong> 90 dias para eventual reativação;</li>
            <li><strong>Após exclusão:</strong> dados pessoais são removidos imediatamente. Backups são purgados em até 30 dias;</li>
            <li><strong>Dados fiscais:</strong> mantidos pelo prazo legal (5 anos).</li>
          </ul>

          <h2 style={s.h2}>7. Seus direitos como titular (LGPD Art. 18)</h2>
          <p>Você pode, a qualquer momento:</p>
          <ul style={s.lista}>
            <li>📋 <strong>Acessar</strong> seus dados — visíveis no próprio app;</li>
            <li>✏️ <strong>Corrigir</strong> dados incompletos ou desatualizados;</li>
            <li>📥 <strong>Exportar</strong> seus dados em formato legível — opção "Exportar dados" nas Configurações;</li>
            <li>🗑️ <strong>Excluir</strong> sua conta e dados — opção "Excluir minha conta" nas Configurações;</li>
            <li>↩️ <strong>Revogar consentimento</strong> a qualquer momento;</li>
            <li>📨 <strong>Solicitar informações</strong> sobre o tratamento.</li>
          </ul>
          <p>Para exercer esses direitos: <strong>suporte@lumengestaoempresarial.com.br</strong></p>

          <h2 style={s.h2}>8. Segurança</h2>
          <p>Adotamos medidas técnicas e organizacionais para proteger seus dados:</p>
          <ul style={s.lista}>
            <li>🔐 Criptografia HTTPS (TLS 1.3) em todas as conexões;</li>
            <li>🔒 Senhas armazenadas com hash bcrypt (jamais em texto plano);</li>
            <li>🛡️ Row Level Security (RLS) no banco — cada usuário só acessa seus próprios dados;</li>
            <li>📊 Backups automáticos diários com retenção de 7 dias.</li>
          </ul>

          <h2 style={s.h2}>9. Incidentes de segurança</h2>
          <p>Em caso de incidente que possa causar risco aos titulares, comunicaremos a ANPD e os afetados em até 72 horas, conforme LGPD Art. 48.</p>

          <h2 style={s.h2}>10. Transferência internacional</h2>
          <p>Alguns provedores (Supabase, Vercel) podem armazenar dados em servidores fora do Brasil. Todos cumprem cláusulas contratuais padrão de proteção de dados.</p>

          <h2 style={s.h2}>11. Crianças e adolescentes</h2>
          <p>A Lumen não é destinada a menores de 18 anos. Não coletamos intencionalmente dados de crianças.</p>

          <h2 style={s.h2}>12. Alterações nesta política</h2>
          <p>Podemos atualizar esta política. Alterações relevantes serão comunicadas por e-mail e no app com 30 dias de antecedência.</p>

          <h2 style={s.h2}>13. Encarregado de Dados (DPO)</h2>
          <p>Jonathan Cardoso<br />
          E-mail: suporte@lumengestaoempresarial.com.br<br />
          WhatsApp: (54) 99941-9628<br />
          Instagram: <a href="https://instagram.com/lumengestaoempresarial" target="_blank" rel="noreferrer" style={s.link}>@lumengestaoempresarial</a><br />
          Facebook: <a href="https://facebook.com/lumengestaoempresarial" target="_blank" rel="noreferrer" style={s.link}>/lumengestaoempresarial</a></p>

          <h2 style={s.h2}>14. ANPD</h2>
          <p>Caso suas dúvidas não sejam resolvidas, você pode contatar a <a href="https://www.gov.br/anpd/pt-br" target="_blank" rel="noreferrer" style={s.link}>Autoridade Nacional de Proteção de Dados (ANPD)</a>.</p>

        </div>
      </div>
    </div>
  )
}

const s = {
  page: { height: '100vh', overflowY: 'auto', background: 'var(--bg, #FBF6F8)', padding: '40px 20px 80px' },
  container: { maxWidth: 760, margin: '0 auto' },
  voltarBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', padding: '6px 0', marginBottom: 18, fontFamily: 'inherit' },
  header: { textAlign: 'center', marginBottom: 32 },
  icon: { width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: '0 8px 20px rgba(30,64,175,0.3)' },
  titulo: { fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 32, fontWeight: 400, color: 'var(--text)', margin: 0 },
  versao: { fontSize: 12, color: 'var(--text3)', margin: '8px 0 0' },
  conteudo: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '32px 28px', fontSize: 14, lineHeight: 1.7, color: 'var(--text2)', boxShadow: 'var(--shadow-sm)' },
  h2: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 16, fontWeight: 700, color: 'var(--text)', marginTop: 24, marginBottom: 8 },
  h3: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginTop: 14, marginBottom: 6 },
  lista: { paddingLeft: 22, margin: '6px 0' },
  link: { color: 'var(--pink)', textDecoration: 'underline', fontWeight: 600 },
  aviso: { background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 'var(--radius-sm)', padding: '12px 14px', fontSize: 13, color: '#78350F', margin: '12px 0' },
}
