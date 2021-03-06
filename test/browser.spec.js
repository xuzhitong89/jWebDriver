var path = require('path');
var os = require('os');
var express = require('express');
var JWebDriver = require('../');
var expect  = require("expect.js");
var co  = require("co");
require('mocha-generators').install();

var isWin32 = process.platform === 'win32';
var phantomjs = process.env['phantomjs'] || !isWin32;

var driverPort = 4444;
if(phantomjs){
    driverPort = 4445;
    runBrowserTest('phantomjs');
}
else{
    runBrowserTest('chrome');
    // runBrowserTest('firefox');
    // runBrowserTest('ie');
}

function runBrowserTest(browserName){

	describe('Browser - ' + browserName + ' : ', function(){

		var browser, server;
		var testPath = 'http://127.0.0.1';

		before(function*(){

            yield new Promise(function(resolve){
                //init http server
                var app = express();
                app.use(express.static(__dirname + '/public'));
                server = app.listen(5555, function(){
                    testPath += ':' + server.address().port+'/browsers/';
                    resolve();
                });
            }).then(function(){
                var driver = new JWebDriver({
                    port: driverPort,
                    logLevel: 0,
                    speed: 0
                });
                return driver.session(browserName).sessions().then(function(arrSessions){
                    var arrPromise = arrSessions.map(function(session){
                        return session.close();
                    });
                    return Promise.all(arrPromise);
                }).session({
                    browserName: browserName,
                    hosts: '127.0.0.1 www.alibaba.com'
                }, function(error, ret){
                    browser = ret;
                });
            });

		});

		it('should sleep 234 ms', function*(){

            var startTime = Date.now();
            yield browser.sleep(200);
            var time = Date.now() - startTime;
            expect(time).to.be.within(190, 210);

		});

		it('should goto and read url', function*(){

            yield browser.url(testPath + 'test1.html');
            expect(yield browser.url()).to.be(testPath + 'test1.html');
            yield browser.url(testPath + 'test2.html');
            expect(yield browser.url()).to.be(testPath + 'test2.html');
            yield browser.back();
            expect(yield browser.url()).to.be(testPath + 'test1.html');
            yield browser.forward();
            expect(yield browser.url()).to.be(testPath + 'test2.html');
            // test https
            yield browser.url('https://www.baidu.com/');
            expect(yield browser.url()).to.contain('baidu.com');

		});

        if(!phantomjs){
            it('hosts mode should work', function*(){

                var tmpTestPath = testPath.replace('127.0.0.1', 'www.alibaba.com');
                yield browser.url(tmpTestPath + 'test1.html');
                expect(yield browser.title()).to.be('testtitle');

            });
        }

		it('should refresh page', function*(){

            yield browser.url(testPath + 'test1.html');
            var element = yield browser.find('#kw');
            yield element.val('refresh');
            expect(yield element.attr('value')).to.be('refresh');
            yield browser.refresh();
            element = yield browser.find('#kw');
            expect(yield element.attr('value')).to.be('');

		});

		it('should get title', function*(){

            yield browser.url(testPath + 'test1.html');
            var title = yield browser.title();
            expect(title).to.be('testtitle');

		});

		it('should get html', function*(){

            var html = yield browser.html();
            expect(html).to.match(/<\/head>\s*<body>/i);

		});

		it('should write and get cookie', function*(){

            var arrCookies = yield browser.cookies(true);
            expect(arrCookies.length).to.be(0);
            yield browser.cookie('test1', '111');
            yield browser.cookie('test2','222', {
                expiry: '7 day'
            });
            arrCookies = yield browser.cookies(true);
            expect(arrCookies.length).to.be(2);
            yield browser.cookie('test3', '321');
            expect(yield browser.cookie('test3')).to.be('321');
            yield browser.removeCookie('test3');
            expect(yield browser.cookie('test3')).to.be(undefined);
            yield browser.clearCookies();
            arrCookies = yield browser.cookies(true);
            expect(arrCookies.length).to.be(0);

		});

        it('should write and get localStorage', function*(){

            if(yield browser.support('storage')){
                var arrKeys = yield browser.localStorageKeys();
                expect(arrKeys.length).to.be(0);
                yield browser.localStorage('test1', '111');
                yield browser.localStorage('test2', '222');
                arrKeys = yield browser.localStorageKeys();
                expect(arrKeys.length).to.be(2);
                var value = yield browser.localStorage('test1');
                expect(value).to.be('111');
                yield browser.removeLocalStorage('test1');
                arrKeys = yield browser.localStorageKeys();
                expect(arrKeys.length).to.be(1);
                yield browser.clearLocalStorages();
                arrKeys = yield browser.localStorageKeys();
                expect(arrKeys.length).to.be(0);
            }

        });

        it('should write and get sessionStorage', function*(){

            if(yield browser.support('storage')){
                var arrKeys = yield browser.sessionStorageKeys();
                expect(arrKeys.length).to.be(0);
                yield browser.sessionStorage('test1', '111');
                yield browser.sessionStorage('test2', '222');
                arrKeys = yield browser.sessionStorageKeys();
                expect(arrKeys.length).to.be(2);
                var value = yield browser.sessionStorage('test1');
                expect(value).to.be('111');
                yield browser.removeSessionStorage('test1');
                arrKeys = yield browser.sessionStorageKeys();
                expect(arrKeys.length).to.be(1);
                yield browser.clearSessionStorages();
                arrKeys = yield browser.sessionStorageKeys();
                expect(arrKeys.length).to.be(0);
            }

        });

		it('should eval javascript', function(done){

            co(function*(){
                var ret = yield browser.eval('return document.title;');
                expect(ret).to.be('testtitle');

                ret = yield browser.eval(function(){
                    return document.title;
                });
                expect(ret).to.be('testtitle');

                ret = yield browser.eval(function(arg1, arg2){
                    return arg2;
                }, 123, 321);
                expect(ret).to.be(321);

                ret = yield browser.eval(function(arg1, arg2){
                    return arg2;
                }, [123, 321]);
                expect(ret).to.be(321);

                var element = yield browser.find('#kw');
                ret = yield browser.eval(function(element){
                    return element.tagName;
                }, element);
                expect(ret).to.be('INPUT');

                browser.config({
                    asyncScriptTimeout: 50
                });

                ret = yield browser.eval(function(done){
                    setTimeout(function(){
                        done(document.title);
                    }, 10);
                });
                expect(ret).to.be('testtitle');

                ret = yield browser.eval(function(args1, arg2, done){
                    setTimeout(function(){
                        done(arg2);
                    }, 10);
                }, 123, 321);
                expect(ret).to.be(321);

                yield browser.config({
                    asyncScriptTimeout: 10
                });

                ret = yield browser.eval(function(done){
                    setTimeout(function(){
                        done();
                    }, 50);
                }).catch(function(error){
                    expect(error).to.be('eval timeout');
                });
                expect(ret).to.be(undefined);

                ret = yield browser.eval(function(done){
                    false && done();
                }).catch(function(error){
                    expect(error).to.be('eval timeout');
                });
                expect(ret).to.be(undefined);
            }).then(done).catch(function(error){
                if(error === 'eval timeout'){
                    done();
                }
                else{
                    done(error);
                }
            });

		});

		it('should get screenshot', function*(){

            var fs =require('fs');
            var tempPath = path.resolve(os.tmpdir(),'jwebdriver.png');
            if(fs.existsSync(tempPath)){
                fs.unlinkSync(tempPath);
            }
            var base64Png = yield browser.getScreenshot();
            expect(base64Png).to.be.an('string');
            fs.writeFileSync(tempPath, base64Png, 'base64');
            expect(fs.existsSync(tempPath)).to.be(true);
            if(fs.existsSync(tempPath)){
                fs.unlinkSync(tempPath);
            }

		});

		it('should find element', function*(){

            var activeElement = yield browser.find('active');
            expect(activeElement.length).to.be(1);
            expect(yield activeElement.attr('id')).to.be('kw');
            var testmouse = yield browser.find('#testmouse');
            expect(testmouse.length).to.be(1);
            try{
                yield browser.find('#abcaaa');
            }
            catch(e){
                expect(e).to.be('Find elements failed');
            }
		});

		it('should sendkeys to element', function*(){

            yield browser.eval(function(){
                document.getElementById("kw").focus();
            }).sendKeys('ab{shift}c{shift}');
            var element = yield browser.find('#kw');
            expect(yield element.attr('value')).to.be('abC');
            // keyDown & keyUp
            yield element.clear();
            yield browser.keyDown('SHIFT').sendKeys('abc').keyUp('SHIFT');
            element = yield browser.find('#kw');
            expect(yield element.attr('value')).to.be('ABC');

		});

		it('should send mouse keys', function*(){

            yield browser.url(testPath + 'test1.html');
            var kw = yield browser.find('#kw');
            //mouseMove: element
            yield kw.val('test');
            expect(yield kw.attr('value')).to.be('test');
            yield browser.mouseMove(kw).click().sleep(200);
            expect(yield kw.attr('value')).to.be('1');
            //dbclick
            yield browser.dblClick().sleep(200);
            expect(yield kw.attr('value')).to.be('2');
            var testmouse = yield browser.find('#testmouse');
            yield browser.mouseMove(testmouse).sleep(100);
            //mousedown
            yield browser.mouseDown().sleep(200);
            expect(yield testmouse.attr('value')).to.be('3');
            //mouseup
            yield browser.mouseUp().sleep(200);
            expect(yield testmouse.attr('value')).to.be('4');

		});

		it('should wait element', function*(){

            // wait displayed
            try{
                yield browser.find('#wait1');
            }
            catch(e){
                expect(e).to.be('Find elements failed');
            }
            yield browser.eval(function(){
                setTimeout(function(){
                    document.body.innerHTML='<input type="text" id="wait1">';
                }, 100);
            });
            var wait = yield browser.wait('#wait1');
            expect(wait.length).to.be(1);
            yield browser.eval(function(){
                setTimeout(function(){
                    document.body.innerHTML='<input type="text" id="wait2" style="display:none">';
                }, 100);
            });
            try{
                yield browser.wait('#wait2', 300);
            }
            catch(e){
                expect(e).to.contain('Wait elelment displayed timeout');
            }
            // wait dom
            yield browser.eval(function(){
                setTimeout(function(){
                    document.body.innerHTML='<input type="text" id="wait3" style="display:none">';
                }, 100);
            });
            wait = yield browser.wait('#wait3', {
                displayed: false
            });
            expect(wait.length).to.be(1);
            // wait removed
            yield browser.eval(function(){
                setTimeout(function(){
                    document.body.innerHTML='all removed';
                }, 100);
            });
            try{
                yield browser.wait('#wait3', {
                    removed: true
                });
            }
            catch(e){
                expect(e).to.contain('Wait elelment removed timeout');
            }
		});

        it('should dragdrop element', function*(){

            yield browser.url(testPath+'dragdrop.html');
            var draggable = yield browser.find('#draggable');
            var offset = yield draggable.offset();
            expect(offset.x).to.below(10);
            expect(offset.y).to.below(10);
            yield browser.dragDrop(draggable, {
                selector: 'body',
                x: 501,
                y: 502
            });
            offset = yield draggable.offset();
            expect(offset.x).to.above(400);
            expect(offset.y).to.above(400);

        });

        it('should scrollTo', function*(){

            yield browser.size(1024, 768);
            var draggable = yield browser.find('#draggable');
            var offset = yield draggable.offset(true);
            expect(offset.y).to.above(380);
            yield browser.scrollTo(draggable);
            offset = yield draggable.offset(true);
            expect(offset.y).to.below(200);
            yield browser.scrollTo(0, 0);
            offset = yield draggable.offset(true);
            expect(offset.y).to.above(400);

        });

        it('should get and set alert', function*(){

            if(yield browser.support('alert')){
                yield browser.url(testPath + 'test1.html');
                var alert = yield browser.find('#alert');
                yield alert.click().sleep(500);
                expect(yield browser.getAlert()).to.be('111');
                yield browser.acceptAlert();
                // confirm
                var confirm = yield browser.find('#confirm');
                yield confirm.click().sleep(500);
                expect(yield browser.getAlert()).to.be('222');
                yield browser.dismissAlert();
                expect(yield confirm.attr('value')).to.be('false');
                // prompt
                var prompt = yield browser.find('#prompt');
                yield prompt.click().sleep(500);
                expect(yield browser.getAlert()).to.be('333');
                yield browser.setAlert('444').acceptAlert();
                expect(yield prompt.attr('value')).to.be('444');
            }

        });

        it('should switchTo window', function*(){

            yield browser.url(testPath + 'test1.html');
            var testwindow = yield browser.find('#testwindow');
            expect(testwindow.length).to.be(1);
            yield testwindow.click().sleep(200);
            var curWindowHandle = yield browser.windowHandle();
            var arrWindowHandles = yield browser.windowHandles();
            expect(arrWindowHandles.length).to.be(2);
            yield browser.switchWindow(1);
            //no element
            try{
                yield browser.find('#testwindow');
            }
            catch(e){
                expect(e).to.be('Find elements failed');
            }
            yield browser.closeWindow();
            arrWindowHandles = yield browser.windowHandles();
            expect(arrWindowHandles.length).to.be(1);
            yield browser.switchWindow(0);
            testwindow = yield browser.find('#testwindow');
            expect(testwindow.length).to.be(1);
            var newCurWindowHandle = yield browser.windowHandle();
            expect(newCurWindowHandle).to.be(curWindowHandle);
            // new window
            var newWindowHandle = yield browser.newWindow(testPath + 'test2.html');
            yield browser.switchWindow(newWindowHandle);
            var test2input = yield browser.find('#test2input');
            expect(test2input.length).to.be(1);
            yield browser.closeWindow().switchWindow(curWindowHandle);
            testwindow = yield browser.find('#testwindow');
            expect(testwindow.length).to.be(1);

        });

        it('should switchTo frame', function*(){

            yield browser.url(testPath + 'test1.html');
            var frames = yield browser.frames();
            expect(frames.length).to.be(1);
            var testwindow = yield browser.find('#testwindow');
            expect(testwindow.length).to.be(1);
            // switch to frame
            yield browser.switchFrame('#testiframe');
            try{
                yield browser.find('#testwindow');
            }
            catch(e){
                expect(e).to.be('Find elements failed');
            }
            // switch to main page
            yield browser.switchFrame(null);
            testwindow = yield browser.find('#testwindow');
            expect(testwindow.length).to.be(1);
            // switch to frame
            yield browser.switchFrame('#testiframe');
            try{
                yield browser.find('#testwindow');
            }
            catch(e){
                expect(e).to.be('Find elements failed');
            }
            if(browser.browserName !== 'phantomjs'){
                // switch to parent
                yield browser.switchFrameParent();
                testwindow = yield browser.find('#testwindow');
                expect(testwindow.length).to.be(1);
            }

        });

        it('should set and get size of window', function*(){

            yield browser.size(501,502);
            var newSize = yield browser.size();
            expect(newSize.width).to.be(501);
            expect(newSize.height).to.be(502);
            yield browser.size({'width': 603,'height': 604});
            newSize = yield browser.size();
            expect(newSize.width).to.be(603);
            expect(newSize.height).to.be(604);

        });

        it('should set and get offset of window', function*(){

            if(browser.browserName !== 'phantomjs'){
                yield browser.offset(101,102);
                var newOffset = yield browser.offset();
                expect(newOffset.x).to.be(101);
                expect(newOffset.y).to.be(102);
                yield browser.offset({'x': 203,'y': 204});
                newOffset = yield browser.offset();
                expect(newOffset.x).to.be(203);
                expect(newOffset.y).to.be(204);
            }

        });

        it('should maximize window', function*(){

            yield browser.size(501,502);
            var newSize = yield browser.size();
            expect(newSize.width).to.be(501);
            expect(newSize.height).to.be(502);
            yield browser.maximize();
            newSize = yield browser.size();
            expect(newSize.width).to.be.above(501);
            expect(newSize.height).to.be.above(502);

        });

		after(function*(){
			server.close();
            yield browser.close();
		});
	});

}
