import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText } from 'lucide-react'

export const TERMOS_VERSAO = '1.2.0'
export const TERMOS_DATA = '4 de Junho de 2026'

export default function Termos() {
  const navigate = useNavigate()
  return (
    <div style={s.page}>
      <div style={s.container}>
        <button style={s.voltarBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> Voltar
        </button>

        <div style={s.header}>
          <div style={s.icon}><FileText size={26} color="white" /></div>
          <h1 style={s.titulo}>Termos de Uso</h1>
          <p style={s.versao}>Versão {TERMOS_VERSAO} · Atualizado em {TERMOS_DATA}</p>
        </div>

        <div style={s.conteudo}>

          <h2 style={s.h2}>1. Aceitação dos Termos</h2>
          <p>Ao criar uma conta ou utilizar a Lumen, você concorda integralmente com estes Termos de Uso e com nossa <a href="/privacidade" style={s.link}>Política de Privacidade</a>. Se você não concordar, não utilize a plataforma.</p>

          <h2 style={s.h2}>2. Sobre a Lumen</h2>
          <p>A Lumen é uma plataforma SaaS (Software as a Service) destinada a profissionais de manicure, pedicure e nail designers, oferecendo ferramentas para gestão de agenda, clientes, financeiro e comunicação.</p>

          <h2 style={s.h2}>3. Cadastro e Conta</h2>
          <ul style={s.lista}>
            <li>Você deve ter no mínimo 18 anos para criar uma conta.</li>
            <li>As informações fornecidas devem ser verdadeiras e atualizadas.</li>
            <li>Você é responsável pela confidencialidade da sua senha.</li>
            <li>Não é permitido compartilhar credenciais ou criar contas falsas.</li>
          </ul>

          <h2 style={s.h2}>4. Período de Teste e Assinatura</h2>
          <ul style={s.lista}>
            <li>Toda nova conta recebe 14 (quatorze) dias de acesso gratuito, sem necessidade de cartão de crédito.</li>
            <li>Após o período de teste, é necessário assinar um plano pago para manter o acesso completo.</li>
            <li>Cada plano pode ser contratado em dois ciclos: <strong>mensal</strong> (cobrado todo mês, com renovação automática) ou <strong>anual</strong> (por um valor reduzido por mês; o total dos 12 meses pode ser <strong>parcelado em até 12× no cartão</strong>, garantindo o acesso por 12 meses. A renovação ao fim do período é feita mediante nova contratação).</li>
            <li>O plano <strong>Solo</strong> inclui 1 login. O plano <strong>Pro</strong> inclui 1 login com todas as funcionalidades avançadas. O plano <strong>Salão</strong> inclui os logins de dona e recepcionista, com possibilidade de adicionar profissionais por valor mensal por usuário, conforme a <a href="/planos" style={s.link}>página de planos</a>.</li>
            <li>Os pagamentos são processados de forma segura por gateway de pagamento (Asaas), no cartão de crédito. A Lumen não armazena os dados do seu cartão.</li>
          </ul>

          <h2 style={s.h2}>5. Cancelamento e Reembolso</h2>
          <ul style={s.lista}>
            <li><strong>Sem fidelidade e sem multa.</strong> Você pode cancelar a assinatura a qualquer momento.</li>
            <li><strong>Garantia de 7 dias:</strong> se cancelar em até 7 (sete) dias após a contratação, devolvemos 100% do valor pago, sem qualquer custo (direito de arrependimento, CDC Art. 49).</li>
            <li>No plano <strong>mensal</strong>: ao cancelar, o acesso permanece até o fim do mês já pago e não há novas cobranças.</li>
            <li>No plano <strong>anual</strong>: como o período de 12 meses já foi pago na contratação, ao cancelar (após os 7 dias de garantia) o acesso permanece até o fim desse período já pago, <strong>sem reembolso proporcional</strong>, e a assinatura simplesmente não é renovada.</li>
            <li>Após o término da assinatura, seus dados ficam guardados por 90 dias para eventual reativação.</li>
          </ul>

          <h2 style={s.h2}>6. Uso Permitido</h2>
          <p>Você concorda em utilizar a Lumen apenas para fins lícitos e relacionados à sua atividade profissional. É vedado:</p>
          <ul style={s.lista}>
            <li>Utilizar a plataforma para atividades ilegais, fraudulentas ou abusivas;</li>
            <li>Tentar acessar dados de outros usuários ou contornar mecanismos de segurança;</li>
            <li>Distribuir conteúdo malicioso (malware, spam) através da plataforma;</li>
            <li>Realizar engenharia reversa, descompilar ou copiar o software.</li>
          </ul>

          <h2 style={s.h2}>7. Dados das Suas Clientes</h2>
          <p>Você (controlador) é responsável legal pelos dados que cadastra de suas clientes finais (titulares). Ao usar a Lumen:</p>
          <ul style={s.lista}>
            <li>Você declara possuir base legal para tratar esses dados (consentimento, execução de contrato);</li>
            <li>Você deve informar suas clientes sobre o uso da Lumen como ferramenta de gestão;</li>
            <li>A Lumen atua como operador (Art. 5º, VII, LGPD), tratando dados em seu nome.</li>
          </ul>

          <h2 style={s.h2}>8. Integrações de Terceiros</h2>
          <p>A Lumen oferece integrações opcionais com Google Calendar e WhatsApp. Ao ativá-las, você concorda com os respectivos termos:</p>
          <ul style={s.lista}>
            <li>Google Calendar — <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer" style={s.link}>termos do Google</a></li>
            <li>WhatsApp — <a href="https://www.whatsapp.com/legal" target="_blank" rel="noreferrer" style={s.link}>termos da Meta</a></li>
          </ul>

          <h2 style={s.h2}>9. Disponibilidade e Limitações</h2>
          <p>Empenhamos esforços para manter a plataforma disponível 24/7, mas não garantimos disponibilidade ininterrupta. Manutenções programadas serão comunicadas com antecedência.</p>

          <h2 style={s.h2}>10. Propriedade Intelectual</h2>
          <p>Todo o software, marca, design e código da Lumen são de propriedade exclusiva da empresa. O acesso ao serviço não confere qualquer direito sobre essa propriedade intelectual.</p>

          <h2 style={s.h2}>11. Limitação de Responsabilidade</h2>
          <p>A Lumen não se responsabiliza por:</p>
          <ul style={s.lista}>
            <li>Lucros cessantes ou perdas indiretas decorrentes do uso;</li>
            <li>Falhas em integrações externas (Google, WhatsApp);</li>
            <li>Uso indevido das ferramentas por parte do usuário ou de terceiros.</li>
          </ul>

          <h2 style={s.h2}>12. Alterações nos Termos</h2>
          <p>Podemos atualizar estes Termos a qualquer momento. Mudanças significativas serão comunicadas por e-mail ou notificação no app. O uso continuado após a alteração implica aceite das novas regras.</p>

          <h2 style={s.h2}>13. Foro</h2>
          <p>Fica eleito o foro da Comarca de Caxias do Sul/RS para dirimir quaisquer dúvidas decorrentes destes Termos, com renúncia a qualquer outro, por mais privilegiado que seja.</p>

          <h2 style={s.h2}>14. Contato</h2>
          <p>Em caso de dúvidas, sugestões ou solicitações, entre em contato:</p>
          <ul style={s.lista}>
            <li>WhatsApp: (54) 99941-9628</li>
            <li>E-mail: suporte@lumengestaoempresarial.com.br</li>
            <li>Instagram: <a href="https://instagram.com/lumengestaoempresarial" target="_blank" rel="noreferrer" style={s.link}>@lumengestaoempresarial</a></li>
            <li>Facebook: <a href="https://facebook.com/lumengestaoempresarial" target="_blank" rel="noreferrer" style={s.link}>/lumengestaoempresarial</a></li>
          </ul>

        </div>
      </div>
    </div>
  )
}

const s = {
  page: {
    height: '100vh',
    overflowY: 'auto',
    background: 'var(--bg, #FBF6F8)',
    padding: '40px 20px 80px',
  },
  container: { maxWidth: 760, margin: '0 auto' },
  voltarBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', padding: '6px 0', marginBottom: 18, fontFamily: 'inherit' },
  header: { textAlign: 'center', marginBottom: 32 },
  icon: { width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, var(--pink) 0%, var(--pink-bright) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: '0 8px 20px rgba(var(--pink-rgb),0.3)' },
  titulo: { fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 32, fontWeight: 400, color: 'var(--text)', margin: 0 },
  versao: { fontSize: 12, color: 'var(--text3)', margin: '8px 0 0' },
  conteudo: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '32px 28px', fontSize: 14, lineHeight: 1.7, color: 'var(--text2)', boxShadow: 'var(--shadow-sm)' },
  h2: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 16, fontWeight: 700, color: 'var(--text)', marginTop: 24, marginBottom: 8 },
  lista: { paddingLeft: 22, margin: '6px 0' },
  link: { color: 'var(--pink)', textDecoration: 'underline', fontWeight: 600 },
}
