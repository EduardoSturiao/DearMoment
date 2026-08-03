//transiçao pro login

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', e => {
            const href = link.getAttribute('href');

            // Links âncora: scroll suave, sem transição
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) target.scrollIntoView({ behavior: 'smooth' });
                return;
            }

            // Links externos/outras páginas: transição de fade
            e.preventDefault();
            document.body.classList.add('fade-out');
            setTimeout(() => {
                window.location = link.href;
            }, 500);
        });
    });
});




//validaçao dos campos no registro

const form = document.querySelector('#form');

if (form) { // não executa em páginas sem formulário

let _otpSignupEmail = '';

form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const fields = [
        {
            id: 'name',
            label: 'Nome',
            validator: nameIsValid
        },
        {
            id: 'last_name',
            label: 'Sobrenome',
            validator: nameIsValid
        },
        {
            id: 'birthdate',
            label: 'Nascimento',
            validator: dateIsValid
        },
        {
            id: 'email',
            label: 'E-mail',
            validator: emailIsValid
        },
        {
            id: 'password',
            label: 'Senha',
            validator: passwordIsSecure
        },
        {
            id: 'confirm_password',
            label: 'Confirmar senha',
            validator: passwordMatch
        }
    ]

    const errorIcon = '<i class="fa-solid fa-circle-exclamation"></i>';
    let hasError = false;

    fields.forEach(function (field) {
        const input = document.getElementById(field.id);
        const inputBox = input.closest('.input-box');
        const inputValue = input.value;

        const errorSpan = inputBox.querySelector('.error');
        errorSpan.innerHTML = ''; //Campo ja inicia vazio

        inputBox.classList.remove('invalid')
        inputBox.classList.add('valid')

        const fieldValidator = field.validator(inputValue);

        if (!fieldValidator.isValid) {
            errorSpan.innerHTML = `${errorIcon} ${fieldValidator.errorMessage}`;
            inputBox.classList.add('invalid');
            inputBox.classList.remove('valid');
            hasError = true;
        }
    })

    const genders = document.getElementsByName('gender');
    const radioContainer = document.querySelector('.radio-container');
    const genderErrorSpan = radioContainer.querySelector('.error');

    const selectedGender =  [...genders].find(input => input.checked);

    if (selectedGender) {
        radioContainer.classList.add('valid');
        radioContainer.classList.remove('invalid');
        genderErrorSpan.innerHTML = '';
    } else {
        radioContainer.classList.add('invalid');
        radioContainer.classList.remove('valid');
        genderErrorSpan.innerHTML = `${errorIcon} Selecione um gênero!`;
        hasError = true;
    }

    if (hasError) return;

    /* ── Criação de conta no Supabase Auth ────────────────── */
    if (!window.sb) {
        alert('Erro de conexão com o servidor. Recarregue a página e tente de novo.');
        return;
    }

    const email     = document.getElementById('email').value.trim();
    const password  = document.getElementById('password').value;
    const firstName = document.getElementById('name').value.trim();
    const lastName  = document.getElementById('last_name').value.trim();
    const birthdate = document.getElementById('birthdate').value;
    const gender    = selectedGender.value;

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Criando conta...';

    const emailErrorSpan = document.getElementById('email').closest('.input-box').querySelector('.error');

    const { data, error } = await window.sb.auth.signUp({
        email,
        password,
        options: {
            data: { first_name: firstName, last_name: lastName, birthdate, gender }
        }
    });

    if (error) {
        const msg = /already registered|already exists|User already/i.test(error.message)
            ? 'Este e-mail já possui uma conta. Faça login.'
            : `Não foi possível criar a conta: ${error.message}`;
        emailErrorSpan.innerHTML = `${errorIcon} ${msg}`;
        document.getElementById('email').closest('.input-box').classList.add('invalid');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
        return;
    }

    if (data.user && data.user.identities && data.user.identities.length === 0) {
        emailErrorSpan.innerHTML = `${errorIcon} Este e-mail já possui uma conta. Faça login.`;
        document.getElementById('email').closest('.input-box').classList.add('invalid');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
        return;
    }

    if (data.session) {
        // Confirmação desligada — sessão imediata.
        const pendingPlan = localStorage.getItem('DearMoment_pending_plan');
        document.body.classList.add('fade-out');
        setTimeout(() => {
            window.location.href = pendingPlan ? './pagamento.html' : './index.html';
        }, 500);
    } else {
        // Confirmação por código OTP — exibe painel na mesma página.
        _otpSignupEmail = email;
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
        form.style.display = 'none';
        document.getElementById('otp-email-display').textContent = email;
        document.getElementById('otp-panel').style.display = 'flex';
    }
})

/* ── OTP handlers (cadastro.html) ── */
const otpSubmitBtn = document.getElementById('otp-submit');
const otpResendBtn = document.getElementById('otp-resend');

if (otpSubmitBtn) {
    otpSubmitBtn.addEventListener('click', async () => {
        const token   = document.getElementById('otp-code').value.trim();
        const errorEl = document.getElementById('otp-error');
        errorEl.textContent = '';

        if (token.length < 6) {
            errorEl.textContent = 'Digite o código de 6 dígitos.';
            return;
        }

        otpSubmitBtn.disabled = true;
        otpSubmitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...';

        const { error } = await window.sb.auth.verifyOtp({
            email: _otpSignupEmail,
            token,
            type: 'signup'
        });

        if (error) {
            errorEl.textContent = 'Código inválido ou expirado. Tente novamente.';
            otpSubmitBtn.disabled = false;
            otpSubmitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar código';
            return;
        }

        const pendingPlan = localStorage.getItem('DearMoment_pending_plan');
        document.body.classList.add('fade-out');
        setTimeout(() => {
            window.location.href = pendingPlan ? './pagamento.html' : './index.html';
        }, 500);
    });
}

if (otpResendBtn) {
    otpResendBtn.addEventListener('click', async () => {
        otpResendBtn.disabled = true;
        otpResendBtn.textContent = 'Enviando...';
        await window.sb.auth.resend({ email: _otpSignupEmail, type: 'signup' });
        otpResendBtn.textContent = 'Código reenviado!';
        setTimeout(() => {
            otpResendBtn.disabled = false;
            otpResendBtn.textContent = 'Reenviar código';
        }, 3000);
    });
}

} // fim do if (form)

function isEmpty(value) {
    return value === '';
}

function nameIsValid(value) {
    const validator = {
        isValid: true,
        errorMessage: null
    };

    if (isEmpty(value)) {
        validator.isValid = false;
        validator.errorMessage = 'O campo é obrigatório!';
        return validator;
    }

    const min = 3;
    if (value.length < min){
        validator.isValid = false;
        validator.errorMessage = `O nome deve ter no mínimo ${min} caracteres!`
        return validator;
    }

    const regex = /^[a-zA-Z]/;
    if (!regex.test(value)) {
        validator.isValid = false;
        validator.errorMessage = 'O campo deve conter apenas letras!'
    }

    return validator;
}

function dateIsValid(value) {
    const validator = {
        isValid: true,
        errorMessage: null
    }

    if (isEmpty(value)) {
        validator.isValid = false;
        validator.errorMessage = 'O nascimento é obrigatório!';
        return validator;
    }

    const year = new Date(value).getFullYear();

    if (year < 1920 || year > new Date().getFullYear()) {
        validator.isValid = false;
        validator.errorMessage = 'Data inválida!';
        return validator;
    }

    return validator;
}

function emailIsValid(value) {
    const validator = {
        isValid: true,
        errorMessage: null
    }

    if (isEmpty(value)) {
        validator.isValid = false;
        validator.errorMessage = 'O e-mail é obrigatório!';
        return validator;
    }

    const regex = new RegExp("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$");
    if (!regex.test(value)) {
        validator.isValid = false;
        validator.errorMessage = 'O e-mail precisa ser válido!';
        return validator;
    }

    return validator;
}

function passwordIsSecure(value) {
    const validator = {
        isValid: true,
        errorMessage: null
    }

    if (isEmpty(value)) {
        validator.isValid = false;
        validator.errorMessage = 'O senha é obrigatória!';
        return validator;
    }

    const regex = new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])(?=.{8,})");

    if (!regex.test(value)) {
        validator.isValid = false;
        validator.errorMessage = `
            Sua senha deve conter ao menos: <br/>
            8 dígitos <br/>
            1 letra minúscula <br/>
            1 letra maiúscula  <br/>
            1 número </br>
            1 caractere especial!
        `;
        return validator;
    }

    return validator;
}

function passwordMatch(value) {
    const validator = {
        isValid: true,
        errorMessage: null
    }

    const passwordValue = document.getElementById('password').value;
    
    if (value === '' || passwordValue !== value) {
        validator.isValid = false;
        validator.errorMessage = 'Senhas não condizem!';
        return validator;
    }

    return validator;
}



// contador de combinações possíveis

(function () {
  var el = document.getElementById('combCounter');
  if (!el) return;

  var target   = 1069440;
  var observed = false;

  function animateCounter() {
    var start    = null;
    var duration = 1300;
    function step(ts) {
      if (!start) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var ease = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(ease * target).toLocaleString('pt-BR');
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  var observer = new IntersectionObserver(function (entries) {
    if (entries[0].isIntersecting && !observed) {
      observed = true;
      animateCounter();
    }
  }, { threshold: 0.4 });

  observer.observe(el);
})();


//efeito visual do icone da senha

const passwordIcons = document.querySelectorAll('.password-icon');

passwordIcons.forEach(icon => {
    icon.addEventListener('click', function () {
        const input = this.parentElement.querySelector('.form-control');
        input.type = input.type === 'password' ? 'text' : 'password';
        this.classList.toggle('fa-eye');
    })
})

