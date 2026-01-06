import asyncio
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None
    
    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()
        
        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",         # Set the browser window size
                "--disable-dev-shm-usage",        # Avoid using /dev/shm which can cause issues in containers
                "--ipc=host",                     # Use host-level IPC for better stability
                "--single-process"                # Run the browser in a single process mode
            ],
        )
        
        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        context.set_default_timeout(5000)
        
        # Open a new page in the browser context
        page = await context.new_page()
        
        # Navigate to your target URL and wait until the network request is committed
        await page.goto("http://localhost:5173", wait_until="commit", timeout=10000)
        
        # Wait for the main page to reach DOMContentLoaded state (optional for stability)
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=3000)
        except async_api.Error:
            pass
        
        # Iterate through all iframes and wait for them to load as well
        for frame in page.frames:
            try:
                await frame.wait_for_load_state("domcontentloaded", timeout=3000)
            except async_api.Error:
                pass
        
        # Interact with the page elements to simulate user flow
        # -> Input username and password, then click login button to access Financial Dashboard
        frame = context.pages[-1]
        # Input the username in the email field
        elem = frame.locator('xpath=html/body/div/div/div/div/form/div/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('admin@example.com')
        

        frame = context.pages[-1]
        # Input the password in the password field
        elem = frame.locator('xpath=html/body/div/div/div/div/form/div/div[2]/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('admin1234')
        

        frame = context.pages[-1]
        # Click the login button to submit credentials
        elem = frame.locator('xpath=html/body/div/div/div/div/form/div[2]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Click on the Faturamento KPI button (index 16) to open submetric drill-down details
        frame = context.pages[-1]
        # Click on Faturamento KPI button to open detailed submetric drill-down
        elem = frame.locator('xpath=html/body/div/div/div[4]/main/div/div/div[2]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # --> Assertions to verify final state
        frame = context.pages[-1]
        await expect(frame.locator('text=Faturamento').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=R$ 0,00').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Atendimentos').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=0').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Clientes').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=0').nth(1)).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Repasse').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=R$ 0,00').nth(1)).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Margem').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=R$ 0,00').nth(2)).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Média por Atendimento').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=R$ 0,00').nth(3)).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Margem por Atendimento').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=R$ 0,00').nth(4)).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Faturamento por Mês').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Mês Anterior:').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=N/A').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Maior:').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Jan - R$ 0,00').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Menor:').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Jan - R$ 0,00').nth(1)).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Métricas Mensais de FaturamentoTotal: R$ 0,00').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=MÊS').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=FATURAMENTO').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=MARGEM').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=MÉDIA/ATEND').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=MARGEM/ATEND').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Jan').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=R$ 0,00').nth(5)).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Fev').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=R$ 0,00').nth(6)).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Mar').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=R$ 0,00').nth(7)).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Abr').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=R$ 0,00').nth(8)).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Mai').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=R$ 0,00').nth(9)).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Jun').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=R$ 0,00').nth(10)).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Jul').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=R$ 0,00').nth(11)).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Ago').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=R$ 0,00').nth(12)).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Set').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=R$ 0,00').nth(13)).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Out').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=R$ 0,00').nth(14)).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Nov').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=R$ 0,00').nth(15)).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Dez').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=R$ 0,00').nth(16)).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Média').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=R$ 0,00').nth(17)).to_be_visible(timeout=30000)
        await asyncio.sleep(5)
    
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())
    