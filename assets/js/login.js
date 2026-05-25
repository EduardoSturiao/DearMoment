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

<<<<<<< HEAD
    // Login bem-sucedido — persiste sessão simulada até integração com backend
    localStorage.setItem('DearMoment_session', JSON.stringify({ loggedIn: true, email: nameValue }));

    // Redireciona: se vier do wizard, vai para pagamento; senão, vai para home
    const pendingPlan = localStorage.getItem('DearMoment_pending_plan');
=======
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
    const pendingPlan = localStorage.getItem('soulmates_pending_plan');
>>>>>>> 06de5011a601ae9740bc3e7d0e5a7f66eb91b4a6
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.4s ease';
    setTimeout(() => {
        window.location.href = pendingPlan ? './pagamento.html' : './index.html';
    }, 400);
})

function isEmpty(value) {
    return value === '';
}
