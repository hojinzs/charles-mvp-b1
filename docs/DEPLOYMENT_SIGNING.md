# 코드 서명 가이드 (Code Signing Guide)

Electron 앱 배포 시 코드 서명을 통해 사용자의 보안 경고를 방지하고 앱의 신뢰성을 보장합니다.

> ⚠️ 코드 서명은 **선택사항**입니다. 서명 없이도 앱은 빌드되지만, 사용자에게 보안 경고가 표시됩니다.

---

## 🍎 macOS 코드 서명 및 Notarization

### 1. Apple Developer Program 가입

1. [Apple Developer Program](https://developer.apple.com/programs/) 접속
2. 연간 $99 (약 ₩130,000) 가입 필요
3. 가입 승인까지 1-2일 소요

### 2. 인증서 생성

#### Developer ID Application 인증서 발급

1. [Apple Developer > Certificates](https://developer.apple.com/account/resources/certificates/list) 접속
2. "+" 버튼 클릭
3. **"Developer ID Application"** 선택 후 Continue
4. CSR (Certificate Signing Request) 업로드:
   ```bash
   # macOS 키체인에서 CSR 생성
   # 1. Keychain Access 앱 실행
   # 2. Keychain Access > Certificate Assistant > Request a Certificate from a Certificate Authority
   # 3. 이메일, 이름 입력 후 "Saved to disk" 선택
   ```
5. 생성된 `.cer` 파일 다운로드 및 설치 (더블클릭)

#### 인증서를 .p12 파일로 내보내기

1. **Keychain Access** 앱 실행
2. **login** 키체인 > **My Certificates** 선택
3. "Developer ID Application: ..." 인증서 우클릭
4. **Export** 선택 → `.p12` 형식으로 저장
5. 비밀번호 설정 (GitHub Secret용)

### 3. App-Specific Password 생성

1. [Apple ID 관리](https://appleid.apple.com/account/manage) 접속
2. **Sign-In and Security** > **App-Specific Passwords** 클릭
3. "Generate an app-specific password" 클릭
4. 라벨 입력 (예: "charles-notarization")
5. 생성된 비밀번호 복사 및 저장

### 4. GitHub Secrets 설정

#### 인증서를 Base64로 인코딩

```bash
# .p12 파일을 base64로 인코딩
base64 -i Certificates.p12 -o cert-base64.txt
cat cert-base64.txt  # 이 값을 CSC_LINK에 저장
```

#### GitHub Secrets 추가

| Secret 이름 | 값 |
|-------------|-----|
| `CSC_LINK` | base64로 인코딩된 .p12 인증서 내용 |
| `CSC_KEY_PASSWORD` | .p12 파일 내보내기 시 설정한 비밀번호 |
| `APPLE_ID` | Apple Developer 계정 이메일 |
| `APPLE_APP_SPECIFIC_PASSWORD` | 위에서 생성한 App-Specific Password |
| `APPLE_TEAM_ID` | [Apple Developer 멤버십](https://developer.apple.com/account#MembershipDetailsCard)에서 확인 |

---

## 🪟 Windows 코드 서명

### 옵션 1: EV (Extended Validation) 인증서 (권장)

SmartScreen 경고 없이 즉시 신뢰됨. 단, 하드웨어 토큰(USB) 필요.

**발급 기관 (예시):**
- [DigiCert](https://www.digicert.com/signing/code-signing-certificates) - 약 $500/년
- [Sectigo](https://sectigo.com/ssl-certificates-tls/code-signing) - 약 $300/년
- [GlobalSign](https://www.globalsign.com/en/code-signing-certificate) - 약 $400/년

**발급 과정:**
1. 사업자 등록증 및 신분증 제출
2. 전화 인증 (회사 대표번호로)
3. 인증서가 담긴 USB 토큰 수령 (1-2주)

> ⚠️ EV 인증서는 하드웨어 토큰이 필요하여 **GitHub Actions에서 직접 사용 불가**.
> 로컬에서 서명하거나 SignPath, SSL.com과 같은 클라우드 서명 서비스 사용 필요.

### 옵션 2: OV (Organization Validation) 인증서

SmartScreen 신뢰를 쌓으려면 시간이 필요하지만 GitHub Actions에서 사용 가능.

**발급 기관:**
- [SSL.com](https://www.ssl.com/certificates/code-signing/) - 약 $200/년
- [Sectigo](https://sectigo.com/ssl-certificates-tls/code-signing) - 약 $180/년

**발급 과정:**
1. 사업자 정보 제출
2. 전화 또는 문서 인증 (1-3일)
3. `.pfx` 파일 다운로드

### GitHub Secrets 설정

#### 인증서를 Base64로 인코딩

```powershell
# PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificate.pfx"))
```

```bash
# macOS/Linux
base64 -i certificate.pfx -o cert-base64.txt
```

#### GitHub Secrets 추가

| Secret 이름 | 값 |
|-------------|-----|
| `WIN_CSC_LINK` | base64로 인코딩된 .pfx 인증서 내용 |
| `WIN_CSC_KEY_PASSWORD` | .pfx 파일 비밀번호 |

---

## 📋 인증서 없이 배포하는 경우

코드 서명 없이 배포 시 사용자에게 다음 경고가 표시됩니다:

### macOS
```
"Charles Monitor"은(는) Apple에서 확인할 수 없으므로 열 수 없습니다.
```
**우회 방법**: Finder에서 Control+클릭 > 열기 선택

### Windows
```
Windows의 PC 보호
Windows Defender SmartScreen이(가) 인식할 수 없는 앱의 시작을 차단했습니다.
```
**우회 방법**: "추가 정보" 클릭 > "실행" 선택

---

## 🔗 참고 자료

- [Electron Builder - 코드 서명](https://www.electron.build/code-signing)
- [Apple Developer - Notarizing](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Microsoft - 코드 서명 인증서](https://learn.microsoft.com/en-us/windows-hardware/drivers/dashboard/code-signing-cert-manage)
