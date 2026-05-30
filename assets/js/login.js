// efeito visual de icone

const passwordIcons = document.querySelectorAll('.password-icon');

passwordIcons.forEach(icon => {
    icon.addEventListener('click', function () {
        const input = this.closest('.input-field').querySelector('.form-control');
        input.type = input.type === 'password' ? 'text' : 'password';
        this.classList.toggle('fa-eye');
    })
})


// validacao de user e senha

const form = document.querySelector('#form');

// Aviso para quem chegou após cadastro com confirmação de e-mail ligada
if (new URLSearchParams(location.search).get('verifique') === '1') {
    const header = document.querySelector('#form_header');
    if (header) {
        const aviso = document.createElement('p');
        aviso.style.cssText = 'color:#ffb6d9;font-size:13px;margin:8px 0 0;width:100%;';
        aviso.textContent = 'Conta criada! Confirme o e-mail que enviamos antes de entrar.';
        header.insertAdjacentElement('afterend', aviso);
    }
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const errorIcon = `<i class="fa-solid fa-circle-exclamation"></i>`;
    let hasError = false;

    // user (campo #name guarda o e-mail)
    const name = document.querySelector('#name');
    const inputBox = name.closest('.input-box');
    const nameValue = name.value.trim();
    const nameError = inputBox.querySelector('.error');
    nameError.innerHTML = '';

    // senha
    const password = document.querySelector('#password');
    const passwordBox = password.closest('.input-box');
    const passwordValue = password.value;
    const passwordError = passwordBox.querySelector('.error');
    passwordError.innerHTML = '';

    if (isEmpty(nameValue)) {
        nameError.innerHTML = `${errorIcon} O campo é obrigatório`;
        hasError = true;
    }

    if (isEmpty(passwordValue)) {
        passwordError.innerHTML = `${errorIcon} O campo é obrigatório`;
        hasError = true;
    }

    if (hasError) return;

    if (!window.sb) {
        nameError.innerHTML = `${errorIcon} Erro de conexão. Recarregue a página.`;
        return;
    }

    const btn = form.querySelector('button');
    const originalBtnHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Entrando...';

    const { error } = await window.sb.auth.signInWithPassword({
        email: nameValue,
        password: passwordValue,
    });

    if (error) {
        const msg = /Email not confirmed/i.test(error.message)
            ? 'Confirme seu e-mail antes de entrar.'
            : 'E-mail ou senha inválidos.';
        passwordError.innerHTML = `${errorIcon} ${msg}`;
        btn.disabled = false;
        btn.innerHTML = originalBtnHtml;
        return;
    }

    // Login OK — a sessão fica persistida pelo SDK. Redireciona.
    const pendingPlan = localStorage.getItem('DearMoment_pending_plan');
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.4s ease';
    setTimeout(() => {
        window.location.href = pendingPlan ? './pagamento.html' : './index.html';
    }, 400);
})

function isEmpty(value) {
    return value === '';
}

// Recuperação de senha
document.getElementById('forgotLink').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('form_header').style.display = 'none';
    document.getElementById('form').style.display = 'none';
    document.getElementById('recoveryPanel').style.display = 'block';
});

document.getElementById('backToLogin').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('recoveryPanel').style.display = 'none';
    document.getElementById('form_header').style.display = 'flex';
    document.getElementById('form').style.display = 'flex';
});

document.getElementById('btnSendRecovery').addEventListener('click', async () => {
    const email = document.getElementById('recoveryEmail').value.trim();
    const errorEl = document.getElementById('recoveryError');
    const btn = document.getElementById('btnSendRecovery');
    const errorIcon = `<i class="fa-solid fa-circle-exclamation"></i>`;

    errorEl.innerHTML = '';

    if (!email) {
        errorEl.innerHTML = `${errorIcon} Digite seu e-mail`;
        return;
    }

    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Enviando...';

    const { error } = await window.sb.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://dearmoment.com.br/redefinir-senha.html',
    });

    if (error) {
        errorEl.innerHTML = `${errorIcon} Erro ao enviar. Tente novamente.`;
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        return;
    }

    document.getElementById('recoveryPanel').innerHTML = `
        <div style="text-align:center;padding:8px 0;">
            <p style="font-size:32px;margin-bottom:16px;">📬</p>
            <p style="color:#f0f0f0;font-size:15px;font-weight:600;margin-bottom:8px;">Link enviado!</p>
            <p style="color:#8892a4;font-size:13px;line-height:1.6;margin-bottom:24px;">Verifique sua caixa de entrada e clique no link para criar uma nova senha.</p>
            <a href="./login.html" style="font-size:13px;color:#ff6dba;">← Voltar ao login</a>
        </div>
    `;
});
