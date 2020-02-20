//////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////// COMMON LIBRARY /////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////

@Grapes([
  @Grab(group='org.codehaus.groovy.modules.http-builder', module='http-builder', version='0.7.1'),
  @Grab(group='com.google.guava', module='guava', version='19.0'),
  @Grab(group='org.apache.commons', module='commons-lang3', version='3.7')
])

import com.google.common.collect.Lists

import groovy.io.FileType
import groovy.json.JsonSlurper
import groovy.time.TimeCategory 
import groovy.time.TimeDuration

import groovyx.net.http.HTTPBuilder
import groovyx.net.http.HttpResponseException
import groovyx.net.http.RESTClient
import static groovyx.net.http.ContentType.*

import java.awt.Component;
import java.text.SimpleDateFormat;
import java.util.regex.Matcher
import javax.swing.JOptionPane;
import javax.swing.filechooser.FileFilter
import javax.swing.JFileChooser
import org.apache.commons.lang3.SystemUtils
import groovy.json.JsonOutput

class Utils {

  static def commandLogs = [:] ;
  static def scriptLogFile ;
  static def gui = false ;

  static void initLogFile(String logFileName) {
    Utils.checkCreateDir('./logs');
    SimpleDateFormat formatter = new SimpleDateFormat("YYYY-MM-dd_hh-mm-ss");
    String logFileNameWithTime = './logs/'+logFileName+'_'+formatter.format(new Date())+'.log' ;
    Utils.scriptLogFile = new File(logFileNameWithTime) ;
  }

  public static void printlnLog(logLine) {
     Utils.printlnLogFormat(logLine,null);
  }

  public static void printlnLogFormat(logLine,String format=null) {
    if (logLine == null)
      logLine = '';

    if (Utils.scriptLogFile)
      Utils.scriptLogFile << logLine.toString()+"\n" ;

    if (format == null)
      println logLine ;
    else {
      // Go there to add stuff :) https://stackoverflow.com/a/38617204/7113625
      def formatList = ['red' : '^<ESC^>[91m [91m__TEXT__[0m'];
      //if (formatList[format] != null) NV: not working :(
      //  logLine = formatList[format].replace('__TEXT__',logLine);
      println logLine ;
    }

  }

  static void addCommandLog(String command,List<String> outputLogLines) {
    commandLogs[command] = outputLogLines ;
  }

  static List<String> getCommandLog(String command) {
      return commandLogs[command] ;
  }

  static def getCommandLogAsObj(String command) {
      return Utils.fromJsonLogString(getCommandLog(command))
  }

  static executeCommand(String command,String comment,String execDirectory=null,Boolean displayOutput=true) {

    // Manage storage of current directory
    if (execDirectory == null)
        execDirectory = System.properties.'user.dir';
    def prevDirectory = System.properties.'user.dir' ;

    // Display comment
    Utils.printlnLog () ;
    Utils.printlnLog '::: '+comment ;
    // Execute command
    def result = executeOnShell(command, new File(execDirectory),displayOutput) ;

    // Set back previous directory if it changed
    if (System.properties.'user.dir' != prevDirectory) {
        def directory = new File(prevDirectory).getAbsoluteFile();
        System.setProperty("user.dir", directory.getAbsolutePath());
    }
    return !result ;
  }
  

  static executeOnShell(String command, File workingDir,Boolean displayOutput=true) {
    def commandFormatted = addShellPrefix(command);
    Utils.printlnLogFormat ('   [SHELL] '+String.join(" ", commandFormatted),'red') ;
    Utils.printlnLog ('   Shell path: '+workingDir.getAbsolutePath());
    def process = new ProcessBuilder(commandFormatted).directory(workingDir).redirectErrorStream(true).start() ;
    def commandLogLines = [];
    process.inputStream.eachLine {
      if (displayOutput == true) 
         Utils.printlnLog it ;
      commandLogLines << it ;
    } ;
    process.waitFor();
    Utils.addCommandLog(command,commandLogLines);
    def exitValue =  process.exitValue();
    if (exitValue != 0)
        Utils.printlnLog('[ERROR] FAILED COMMAND '+command)
    return exitValue ;
  }
   
  static addShellPrefix(String command) {
    List<String> commandArray = new ArrayList<String>();

    if (System.properties['os.name'].toLowerCase().contains('windows'))
    { // Windows format
      commandArray.add('cmd');
      commandArray.add('/c');
      commandArray.add(command);
    }
    else
    { // Unix / MAC format
      commandArray.add('sh');
      commandArray.add('-c');
      commandArray.add(command);    
    }
    return commandArray
  }

  // test available commands ( can be simple cmd command ( -version will be appended ) , or full command with -version or equivalent)
  // ex: ant 
  // ex: sfdx --version
  static testAvailableCommands(commandList) {
    if (Utils.systemIsLinux())
      return ;
    def workingDir2 = new File(System.properties.'user.dir');
    def cool = true ;
    for (String commandToTest : commandList) { 
        def commandToTestWithVersion = commandToTest ;
        if (!commandToTest.contains('-v'))
           commandToTestWithVersion += ' --version';
        else
            commandToTest = commandToTest.substring(0,commandToTest.indexOf('-') +1);

        def commandFormatted2 = addShellPrefix(commandToTestWithVersion);
        def process2 = new ProcessBuilder(commandFormatted2).directory(workingDir2).redirectErrorStream(true).start() ;
        process2.inputStream.eachLine {Utils.printlnLog it} ;
        process2.waitFor();
        def exitValueTest =  process2.exitValue();
        if (exitValueTest != 0)
        {
          Utils.printlnLog ('[ERROR] command '+commandToTest+' not recognized in the system')
          if (commandToTest == 'ant')
              Utils.printlnLog('Please install Ant -> http://ant.apache.org/bindownload.cgi');
          else if (commandToTest == 'sass')
              Utils.printlnLog('Please install sass (command line) -> http://sass-lang.com/install');
          else if (commandToTest == 'sfdx')
              Utils.printlnLog('Please install salesforce DX (command line) -> https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_install_cli.htm#sfdx_setup_install_cli');
          else if (commandToTest == 'bash')
              Utils.printlnLog('Please activate bash command ( Enable windows subsystem for linux -> https://stackoverflow.com/questions/36352627/how-to-enable-bash-in-windows-10-developer-preview');
          else
              Utils.printlnLog('Please install '+commandToTest+' ->  https://www.google.com/search?q='+commandToTest);
          cool = false ;
        }
    }
    if (!cool)
      System.exit(0);
    Utils.printlnLog();
  }

  // kill process
  static killProcessIfRunning(String serviceName) {
    Process p = Runtime.getRuntime().exec("tasklist");
    BufferedReader reader = new BufferedReader(new InputStreamReader(
    p.getInputStream()));
    String line;
    Boolean killIt = false ;
    while ((line = reader.readLine()) != null) {
      if (line.contains(serviceName))
        killIt = true ;
    }

    if (killIt == true) {
      Runtime.getRuntime().exec("taskkill /F /IM " + serviceName);
      Utils.printlnLog ('Killing process '+serviceName)
      Thread.sleep( 4000 ) 
      return true ;
    }
    else 
      return false ;
  }

  static getFileExtension(fileName) {
        if(fileName.lastIndexOf(".") != -1 && fileName.lastIndexOf(".") != 0)
          return fileName.substring(fileName.lastIndexOf(".")+1);
          else return "";
  }

  static copyFile(fileFrom,fileTo) {
      def ant = new AntBuilder()  
      def fileCopyResult = ant.copy( file: fileFrom, tofile:fileTo, overwrite: true);
      assert fileCopyResult.file.exists(), "Copy file error: "+fileFrom+' to '+fileTo   
      Utils.printlnLog ('   [COPIED] '+fileFrom+' to '+ fileTo) ;
  }

  static checkCreateDir(dirName) {
      def dirCheck = new File( dirName )
      // If it doesn't exist
      if( !dirCheck.exists() ) {
        // Create all folders up-to and including B
        dirCheck.mkdirs();
        Utils.printlnLog 'Created directory '+dirCheck ;
      }
  }

  static copyDir(dirFrom,dirTo) {
      def ant = new AntBuilder()  
      def dirCopyResult = ant.copy( todir: new File(dirFrom)) { fileset(dir: new File(dirTo)) }
      assert new File(dirTo).exists(), "Directory copy error: "+dirTo  
  }

  static copyDirContent(dirFrom,dirTo) {
      def ant = new AntBuilder()  
      def dirCopyResult = ant.copy( todir: new File(dirTo)) { fileset(dir: new File(dirFrom)) }
      assert new File(dirTo).exists(), "Directory copy error: "+dirTo  
  }

  static killFile(file) {
    def tempFile = new File(file);
    if (tempFile.exists()) {
        def ant = new AntBuilder()  ;
        ant.delete(file: tempFile ) ;
        return true ;
    }
    return false ;
  }

  static killDir(directory) {
      def tempDirFile = new File(directory);
      if (tempDirFile.exists()) {
        def ant = new AntBuilder()  ;
        ant.delete(dir: tempDirFile ) ;
        return true ;
      }
      return false ;
  }

  static listDirectoryFiles(directory) {
      def allTempFileandDirLs = [] ;
      def tempDirFile = new File(directory);
      if (!tempDirFile.exists())
        return allTempFileandDirLs ;
      tempDirFile.eachFileRecurse(){ 
        allTempFileandDirLs << it.getAbsolutePath()
      }
      return allTempFileandDirLs ;
  }

  static listDirectories(directory) {
      def dirs = [] ;
      def dirFile = new File(directory);
      if (!dirFile.exists())
        return dirs ;      
      else {
        dirFile.eachFile(){ 
            dirs << it ;
        }        
        return dirs ;  
      }
  }

  static killFiles(directory,fileExtensionList,dirNameList,fileNameList) {

        // Check directory exists & list its folders & files
        def tempDirFile = new File(directory);
        if (!tempDirFile.exists())
          return false ;
        def allTempFileandDirLs = [] ;
        tempDirFile.eachFileRecurse(){ 
          allTempFileandDirLs << it.getAbsolutePath()
        }
        def ant = new AntBuilder()  ;
        // Delete files we don't want
        allTempFileandDirLs.each(){ tempFileNmAbs ->
          def tempFile = new File(tempFileNmAbs);
          if (tempFile.exists()) { 
            def tempFileNm = tempFile.getName() ;
            // Kill by dir name
            if (tempFile.isDirectory() && (dirNameList.contains(tempFileNm) || dirNameList == 'all')) {
                ant.delete(dir: tempFile ) ;
            }
            else  { // Kill by file extensionList
                def ext = tempFileNm.substring(tempFileNm.lastIndexOf('.') + 1);
                if (fileExtensionList.contains(ext) || fileExtensionList == 'all')
                   ant.delete(file: tempFile ) ;
            }
          }
        }
        return true ;
  }

  static isSet(var) {
    return (var != null && var != '' && var != 'false')
  }

  // Parse arguments from CliBuilder
  static parseArgs(cli,args8,mainThis) {
      cli.h (longOpt: 'help', 'Show usage information')
      cli.prompt (longOpt: 'prompt', 'Prompt confirmation to user')
      cli.jsonConfigFile (longOpt: 'jsonConfigFile',args: 1, argName: 'jsonConfigFile', 'JSON config file (can contain any command line argument). If same argument is in command line AND jsonConfigFile, command line wins')
      cli.logFileName (longOpt: 'logFileName',args: 1, argName: 'logFileName', 'Log file name if you need to generate a log file. it will be put in /logs/LOGFILENAME_TIMESTAMP.log')
      cli.gui (longOpt: 'gui', 'Use windows UI instead of shell text')
      // parse command line arguments
      def options = cli.parse(args8) ;
/*
      // parse jsonConfigFile arguments if here 
      if (options.'jsonConfigFile' != null && options.'jsonConfigFile' != '' && options.'jsonConfigFile' != 'false' && options.'jsonConfigFile' != false) {
          def jsonFile = new File(options.'jsonConfigFile');
          if (jsonFile.exists()) {
            def jsonSlurper = new JsonSlurper() ;
            def jsonFileObject = jsonSlurper.parseText(jsonFile.text) ;
            Utils.printlnLog options ;
            jsonFileObject.keySet().each{ argName ->
                def argVal = jsonFileObject[argName] ;
                def existingInOptionVal = options.getProperty(argName);
                Utils.printlnLog existingInOptionVal ;
                // Add/replace only if argument has not been sent in command line
                if ((existingInOptionVal == null || existingInOptionVal == 'false' || existingInOptionVal == false) && argVal != null) {
                   options.invokeMethod(argName, argVal) ;
                   Utils.printlnLog "added "+options[argName]+' : '+argVal ;
                 }
              }
          }
          else
              Utils.printlnLog ('ERROR: jsonConfigFile not found ('+options.'jsonConfigFile'+')' ) ;
      }
*/
      def optionsDisplay = args8.join(" ").replace(" -", "\n-")
      //def optionsDisplay = options.arguments().join(" ").replace(" -", "\n-") ;
      Utils.printlnLog 'Script parameters:' ;
      Utils.printlnLog(optionsDisplay) ;
      def extraArguments = options.arguments()
      if (extraArguments) {
          Utils.printlnLog('[WARNING] Extra arguments not taken in account'+ extraArguments);
      }

      if (options.h) {
          cli.usage()
          System.exit(90) ;
      }

      if (options.'prompt') {
          def scriptName = mainThis.class.getName();
          def ok = Utils.userPromptOkCancel('Please confirm you want to execute script '+scriptName+ "\nScript parameters:\n"+optionsDisplay);
          if (ok == false) {
            Utils.printlnLog('Script execution cancelled by user after prompt')
            System.exit(99) ;
          }
      }

      if (options.'logFileName' && options.'logFileName' != '' && options.'logFileName' != 'false') {
         Utils.initLogFile(options.'logFileName');
      }

      if (options.'gui') {
         Utils.gui = true ;
      }
 
     // Display Logo
     Utils.displayLogo()
     Utils.printlnLog('Start execution on '+new Date())

     return options ;    
  }

  static Boolean userDisplayPopup(String text, String title='Message',msgType=JOptionPane.WARNING_MESSAGE) {
      JOptionPane.showConfirmDialog((Component) null, text, title, JOptionPane.DEFAULT_OPTION,msgType)
  }

  static Boolean userPromptOkCancel(String text, Integer maxInput) {
  		return Utils.userPromptOkCancel(text,null, maxInput)
  }

  static Boolean userPromptOkCancel(String text,String title='Confirmation required', Integer maxInput=5){
    // GUI MODE
    if (gui) {
      def result = JOptionPane.showConfirmDialog((Component) null, text, title, JOptionPane.OK_CANCEL_OPTION); 
      if (result != 0) 
        return false ;
      else
        return true ;
    }
    // TEXT MODE
    else {
      Utils.printlnLog();
      Utils.printlnLog '>>>>>>>';
      Utils.printlnLog title ;
      Utils.printlnLog text ;
      print '>>> Please answer (Y/N) : ' ;
      BufferedReader br = new BufferedReader(new InputStreamReader(System.in)) ;
      def answerText = br.readLine() ;
	  def cptInput = 1;
	  while ((answerText == null || answerText == "" || answerText == "\r\n" || answerText == "\r") && cptInput < maxInput ){
		print '>>> Please answer (Y/N) : ' ;
		answerText = br.readLine() ;
		cptInput++;
	  }
      if (answerText == 'y' || answerText == 'Y')
        return true ;
      else
        return false ;
    }

  }

  // userInputText
  static String userInputText(String question, Integer maxInput=5) {
    print question+' : ' ; 
    BufferedReader br = new BufferedReader(new InputStreamReader(System.in)) ;
	def text = br.readLine();
	def cptInput = 1;
	while ((text == null || text == "" || text == "\r\n" || text == "\r") && cptInput < maxInput ){
		print question+' : ' ; 
		text = br.readLine();
		cptInput++;
	}
    return text ;
  }

  // User select 
  static String userInputSelect(String question,String questionDtl, values, Integer maxInput=5) {
    String[] valuesLs = values ;
    // GUI MODE
    if (gui) {
      Object selected = JOptionPane.showInputDialog(null, question,questionDtl, JOptionPane.DEFAULT_OPTION, null, valuesLs, "0");
      if ( selected != null ){//null if the user cancels. 
        String selectedString = selected.toString();
        Utils.printlnLog 'Selected '+selected ;
        return selectedString ;
      }
      else
      {
        Utils.printlnLog ('No selection has been done')
        return null ;
      }
    }
    // TEXT MODE
    else {
      Utils.printlnLog();
      Utils.printlnLog '>>>>>>>';
      Utils.printlnLog question ;
      Utils.printlnLog questionDtl ;
      def choice = 1 ;
      for (val in valuesLs) {
        Utils.printlnLog (choice+' - '+val) ;
        choice++ ;
      }
      print '>>> Please input the number of your selection : ' ;
      BufferedReader br = new BufferedReader(new InputStreamReader(System.in)) ;
      def answerText = br.readLine() ;
      def cptInput = 1;
      while ((answerText == null || answerText == "" || answerText == "\r\n" || answerText == "\r" || Integer.valueOf(answerText) > valuesLs.size()) &&
              cptInput < maxInput )   {
                print '>>> Please input the number of your selection : ' ;
                answerText = br.readLine() ;
                cptInput++;
      }
      Integer answerNb = Integer.valueOf(answerText) - 1 ;
      if (valuesLs.size() > 0 && valuesLs[answerNb] != null && answerText != '0')
        return valuesLs[answerNb] ;
      else
        return null ;
    }
  }

  // Select directory
  static File userSelectDirectory(String title='Select Directory',String currentDirectory) {
      JFileChooser fileChooser = new JFileChooser();
      fileChooser.setFileSelectionMode( JFileChooser.DIRECTORIES_ONLY);

      if (currentDirectory != null)
         fileChooser.setCurrentDirectory(new File(currentDirectory));

      fileChooser.setDialogTitle(title);

      int option = fileChooser.showOpenDialog(null);
      if (option == JFileChooser.APPROVE_OPTION) {
          File f = fileChooser.getSelectedFile();
          // if the user accidently click a file, then select the parent directory.
          if (!f.isDirectory()) {
              f = f.getParentFile();
          }
          Utils.printlnLog 'Selected directory '+f.getAbsolutePath();
          return f ;
      }
      return null ;
  }

  // LOGO
  static displayLogo() {
      def ascii = "..........................................................................................----------\n......................-:./-:::-.............................................................--------\n...................---:--:-::-:+/-........................................................----------\n................../-....-----..---/:.....................................................-----------\n.................-:.....---.......-//...................................................------------\n................-....-:++-://+/....-/-..................................................------------\n................-..-+so//::://://.../:..................................................------------\n................-.-+hyhs:-:+ohy+/-..-/.................................................-------------\n...............:/.-:oso+::-oyys/::..-o-..............................................-.-------------\n..............-ooo+:++s+yy+/ss/:-/..:o/............................................-..--------------\n..............-+oo///:::oyo:--/:....-+/............................................-.---------------\n.............../ys+:::+oyyy+........-/y-...................---::-/++/-/:-..........-----------------\n.............../ssyy++sso+/:---:/-..--s-................--:o+---.:/+/:::-+///:-.-.------------------\n...............-sososhhhyyso+/---.....+/...........-://+++/::-.....----::::::ss+--------------------\n...............:+s+//+/+///:-....--::.-s-......-:/+o+/-.-----------------------:++:-----------------\n...............:s+ydy++////::/::/+::/-.s/..:/oo+/:...--------------------..------:+:---------------:\n...............:y-+ysysss++oo+/:sdo:-..sho+++/-..-.../-./:------------------:::::::+:--------------:\n...............-s-:/:/++++///:/::o/--../y+-......-..--..o:--------+/:-:::--:-:::::-:o--------------:\n...............-s--+oo/+//////:/:::-...-y+o++:-....-+sso+sss+:---:///:+::::+y/:-:---/o-------------:\n...............++-::+s/+://////:::-.....+s:--://-...-syys--::y-.--::::::/:::hy::----ss-------------:\n...........--..s:--:-----::////::-......//.-:--//:-...:+y:..-+-.--/-:+://:::sh/o+-:oyy-------------:\n....----..-.---+-.-----:-::///:--.....-/:o:/::++o+:.....:o-.......--:o/+o/::oo+omo:y+h--------------\n-...--::://:o+++/.-:-::::///:::--.-::/:-//-/::+/:+/....../-.-:-----:-:o+o//:s:/ymsosys----:---------\n--.....--:::/:-+s-/so+o+::::::::-::::-:/:..-:::so/-+--.------/+:----:-+y//:+y++ysoy+h://:-----------\n------.----:::/:+/:+soossssoso++/+o//+:------::/y/::---------/+/:---:-:s::/yo+oy+osoh+oo/:::-------:\n------------:+s::/-:osssosysso++/+/---------/::/y/:----------o/::--:-:/y+/oso+o+ssoyh++s+----------:\n----:::/+:---//--/:-/+oo++oo/+/::::--------////:/:----------:s::::-/-:/yy++y+sysosyy+/////::------::\n--------::--------o/-:/o+//o:::::////:----:s:/h/////:-::--+/++::::////odoysyshsoshs+++/+///:------::\n------------------:+//::////////+///------oo:os+///:://::/o:+/://++o++shohoyyo+/+++++/+////:-----:::\n-------------:-----/o++++++o++//:::::---:+/+:://///:-//://++o:/oso+oshhso+/////++///++++/::------:::\n:----------------:/++s+/:/+/:::::::---/s++//://///::-///+/sdossyyys+++///////+hs+/+/+/+/::-------:::\n+--------:---::-:+++++++:---:--:/:/+oshsoo:///////////soo+yo/////+////++//////syssssso/----------:::\n-------------++//+/++//++++++so/+ossssso+:/+yo+oohhsyyo+++o++++++//+++ho+/////////:::::----------:::\n------------/+o+/////+//+/+ssyyhhyshmhdyhhhssyyoo+////++/+///+o/+///://///:::--------------------:::\n---------------/+///+++++++++//+/+hho+o/+o+////::::::---------:::-:::::::::-----------//--------:::" ;
      Utils.printlnLog()
      Utils.printlnLog(ascii);
      Utils.printlnLog('Powered by DXC OmniChannel Team. https://appexchange.salesforce.com/appxListingDetail?listingId=a0N3A00000ErDhDUAV / Contact: Nicolas Vuillamy (nvuillam@dxc.com) ');
      Utils.printlnLog()
  }


  static systemIsLinux() {
    return SystemUtils.IS_OS_LINUX ;
  }

  // String utils
  public static String substringBefore(String str, String separator) {
      if (isStringEmpty(str)) {
          return str;
      }
      if (isStringEmpty(separator)) {
          return "";
      }
      int pos = str.indexOf(separator);
      if (pos == -1) {
          return "";
      }
      return str.substring(0,(pos + separator.length())-1);
  }

  public static String substringAfter(String str, String separator) {
      if (isStringEmpty(str)) {
          return str;
      }
      if (isStringEmpty(separator)) {
          return "";
      }
      int pos = str.indexOf(separator);
      if (pos == -1 || pos == (str.length() - separator.length())) {
          return "";
      }
      return str.substring(pos + separator.length());
  }

  public static String substringAfterLast(String str, String separator) {
      if (isStringEmpty(str)) {
          return str;
      }
      if (isStringEmpty(separator)) {
          return "";
      }
      int pos = str.lastIndexOf(separator);
      if (pos == -1 || pos == (str.length() - separator.length())) {
          return "";
      }
      return str.substring(pos + separator.length());
  }

  public static boolean isStringEmpty(String str) {
      return str == null || str.length() == 0;
  }

  public static Boolean stringContainsOneOf(String inputStr,def stringList) {
      Boolean res = false
      stringList.each { toCheck ->
          if (inputStr.contains(toCheck))
            res = true
      }
      return res
  }

  public static String toJsonString(someVar) {
      def json = new groovy.json.JsonBuilder()
      json someVar ;
      def jsonStr = groovy.json.JsonOutput.prettyPrint(json.toString()) ;    
      return jsonStr ;
  }

  public static String toJsonStringFlat(someVar) {
      def json = new groovy.json.JsonBuilder()
      json someVar ;
      return json.toString() ;
  }

  public static fromJsonString(someVar) {
      def slurper = new JsonSlurper()
      def parseRes  ;
      try {
          Matcher myMatcher = someVar.substring(0,2) =~ /\[[A-z]/ // regex [ + alphanumeric matcher
          if (!someVar.startsWith('{') && (!someVar.startsWith('[') || myMatcher.getCount() > 0) ) 
            if (someVar.indexOf('{') != null) {
              someVar = someVar.substringAfter('{')
            }
            else if (someVar.indexOf('[') != null) {
              someVar = someVar.substringAfter('[')
            }
            parseRes = slurper.parseText(someVar); 
          } catch (Exception e)          {
            parseRes = null ;
          }
      return parseRes ;
  }

  public static fromJsonLogString(someListOfLogLines) {
      def result = null; 
      // Try to find JSON in a single line
      someListOfLogLines.each { line -> 
          def jsonFound = Utils.fromJsonString(line);
          if (jsonFound != null)
            result = jsonFound ;
      }
      // Try to find json from indented lines
      if (result == null) {
          def jsonFound = Utils.fromJsonString(someListOfLogLines.join(' '));
          if (jsonFound != null)
            result = jsonFound ;
      }

      return result;
  }

  public static getJsonFile(jsonFilePath) {
    def file = new File(jsonFilePath)
    if (!file.exists())
      return null 
    def jsonFileContent = Utils.fromJsonString(file.text)
    if (jsonFileContent != null)
      return jsonFileContent
    else
      return null 
  }

  public static getPropInJsonFile(jsonFilePath,propName) {
    def file = new File(jsonFilePath)
    if (!file.exists())
      return null 
    def jsonFileContent = Utils.fromJsonString(file.text)
    if (jsonFileContent != null)
      return jsonFileContent[propName]
    else
      return null 
  }

  public static setPropInJsonFile(jsonFilePath,propName,val) {
    def file = new File(jsonFilePath)
    def jsonFileContent
    if (file.exists())
      jsonFileContent = Utils.fromJsonString(file.text)
    else 
      jsonFileContent = [:]
    jsonFileContent[propName] = val
    file.text = Utils.toJsonString(jsonFileContent)
  }

  // Elapse utils
  static startElapse(nameIn) {
      return new UtilsElapse(nameIn);
  }

  static stopElapse(utilsElapseInstance) {
      utilsElapseInstance.stop()
  }

  static displayImportant() {
    def ascii = ".%%%%%%..%%...%%..%%%%%....%%%%...%%%%%...%%%%%%...%%%%...%%..%%..%%%%%%.\n...%%....%%%.%%%..%%..%%..%%..%%..%%..%%....%%....%%..%%..%%%.%%....%%...\n...%%....%%.%.%%..%%%%%...%%..%%..%%%%%.....%%....%%%%%%..%%.%%%....%%...\n...%%....%%...%%..%%......%%..%%..%%..%%....%%....%%..%%..%%..%%....%%...\n.%%%%%%..%%...%%..%%.......%%%%...%%..%%....%%....%%..%%..%%..%%....%%...\n........................................................................."
    Utils.printlnLog(ascii);
  }

  static getExternalApiUrl () {
    return 'https://kvdb.io/XXXXXX'
  } 

 // get global key value
  static getExternalValue(String globalKeyPrefix) {
    if (globalKeyPrefix == null) {
      return null ;
    }
    def http = new HTTPBuilder(getExternalApiUrl());
    def jsonResult 
    try {
      http.get(path: globalKeyPrefix,
              contentType : 'application/json') {  resp, json ->
            jsonResult = json
           }
    } catch(HttpResponseException e){

    }
    return jsonResult ;
  }

  // get prop from global key value
  static getExternalValue(String globalKeyPrefix,String keyName) {
    if (globalKeyPrefix == null) {
      return null ;
    }
    def globalKeyValue = getExternalValue(globalKeyPrefix);
    if (globalKeyValue == null) {
      return null ;
    }    
    Utils.printlnLog('Got external value '+keyName+' from '+globalKeyPrefix+': '+keyName);
    return globalKeyValue[keyName] ;
  }  

  // Set globalkey value 
  static setExternalValue(String globalKeyPrefix, def value) {
    if (globalKeyPrefix == null) {
      return null ;
    }
    def http = new HTTPBuilder(getExternalApiUrl());
    def body = groovy.json.JsonOutput.toJson(value)
    def httpResp ;
    try {
       http.post(
              path: globalKeyPrefix,
              body: body ){ resp ->

          }
    } catch(HttpResponseException e){
        Utils.printlnLog "Error code: ${e.getStatusCode()} for POST ${getExternalApiUrl() + globalKeyPrefix} : ${body}"
        Utils.printlnLog e.getMessage();
        return null ;
    }
    Utils.printlnLog('Stored externally: '+globalKeyPrefix+'='+body);
    return true ;
  }

  // Set prop in glboal key value
  static setExternalValue(String globalKeyPrefix, String keyName,def value) {
    if (globalKeyPrefix == null) {
      return null ;
    }
    def globalKeyValue = getExternalValue(globalKeyPrefix);
    if (globalKeyValue == null) {
      globalKeyValue = [:]
    }
    globalKeyValue[keyName] = value ;
    setExternalValue(globalKeyPrefix,globalKeyValue) ;
  }


}

// ELAPSE MANAGEMENT
class UtilsElapse {

      def start ;
      def stop ;
      def name ;

      public UtilsElapse(nameIn) {
        start = new Date()
        this.name = nameIn
        Utils.printlnLog()
        Utils.printlnLog ('###########################     START    '+this.name+ '      #############################' )    
        Utils.printlnLog()

      }

      public stop() {
        this.stop = new Date()
        TimeDuration td = TimeCategory.minus( this.stop, this.start )
        Utils.printlnLog()
        Utils.printlnLog ('----------------     Elapsed time for '+this.name+ ': '+td+'   ------------------' )  
        Utils.printlnLog()  

      }

}


// Package.Xml management

class UtilsPackageXML {

  static String apiVersion = '47.0'

  static packageXMLtoMap(String PackageXMLFileName) {
        def file = new File(PackageXMLFileName);
        def fileLines = file.readLines();
        def packageXMLContentMap = [:];
        def currentTypeItemList = [];
        for (int i=0; i< fileLines.size(); i++) {
          def line = fileLines[i].trim();
          if (line.startsWith('<members>')){
            currentTypeItemList.add(line.substring(0, line.indexOf('</members>')).minus('<members>'));
          }
          else if (line.startsWith('<name>')) {
            def type = line.substring(0, line.indexOf('</name>')).minus('<name>');
            packageXMLContentMap[type] = currentTypeItemList;
            currentTypeItemList = [];
          }
        }
        return packageXMLContentMap;
  }

  static mapToPackageXML(packageXmlMap,String outputPackageXMLFileName,String apiVersionIn=null) {
        if (apiVersionIn == null)
          apiVersionIn = UtilsPackageXML.apiVersion

        def file = new File(outputPackageXMLFileName);
        if (file.exists())
          file.delete();
        file << '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n'
        
        for (def type : packageXmlMap.keySet() ) {
          if (packageXmlMap[type].size() > 0)
          {
            file << ' <types>\n'
            for (def member : packageXmlMap[type]) {
              file << '   <members>'+member+'</members>\n'
            }
            file << '   <name>'+type+'</name>\n'
            file << ' </types>\n'
          }
      }
      file << ' <version>'+apiVersion+'</version>\n'
      file << '</Package>\n'
      Utils.printlnLog ('Generated file '+file.getAbsolutePath());
  }

  static List<String> splitPackageXML(String PackageXMLFileName) {
      def maxChunkSize = 35 ;
      def maxStaticResourcesSize = 10 ;
      def packageXMLFileMap = UtilsPackageXML.packageXMLtoMap(PackageXMLFileName);
      def totalTypeNumber = packageXMLFileMap.keySet().size();
      Utils.printlnLog (PackageXMLFileName+ ' has '+totalTypeNumber+' metadata types')
      if (totalTypeNumber < maxChunkSize) 
        return [PackageXMLFileName];
      else {
          def typeList =  [] ;
          typeList.addAll(packageXMLFileMap.keySet());
          def smallerLists = Lists.partition(typeList, maxChunkSize);
          def splittedPackageXmlFiles = []
          int i = 0 ;
          smallerLists.each { chunkList ->
              i++ ;
              def splittedMap = [:]
              chunkList.each { type ->
                  // Static resources case: avoid to have too many in same package.xml
                  if (type == 'StaticResource' && packageXMLFileMap['StaticResource'] != null && packageXMLFileMap['StaticResource'].size() > maxStaticResourcesSize ) {
                     def smallerListsStaticResource = Lists.partition(packageXMLFileMap['StaticResource'], maxStaticResourcesSize);
                     int j = 0 ;
                     smallerListsStaticResource.each { chunkListStaticResource -> 
                          j++ ;
                          def staticResourceChunkPackageXmlMap = [:]
                          staticResourceChunkPackageXmlMap['StaticResource'] = chunkListStaticResource ;
                          def chunkPackageXmlStaticResourceFileName = 'tmp_'+PackageXMLFileName+'_chunk_'+i+'_staticResource_'+j+'.xml' ;
                          UtilsPackageXML.mapToPackageXML(staticResourceChunkPackageXmlMap,chunkPackageXmlStaticResourceFileName);
                          splittedPackageXmlFiles.add(chunkPackageXmlStaticResourceFileName);                         
                     }
                  }
                  // Normal case: build a package.xml chink with N elements
                  else
                      splittedMap[type] = packageXMLFileMap[type]
              }

              def chunkPackageXmlFileName = 'tmp_'+PackageXMLFileName+'_chunk_'+i+'.xml' ;
              UtilsPackageXML.mapToPackageXML(splittedMap,chunkPackageXmlFileName);
              splittedPackageXmlFiles.add(chunkPackageXmlFileName);
          }
          Utils.printlnLog (PackageXMLFileName+ ' has been chunked into ' + splittedPackageXmlFiles)

          return splittedPackageXmlFiles ;
      }
  }

}

class UtilsAuth {

  static loginToSFDC(String sf_login_domain,String consumer_key,String consumer_secret,String auth_username,String auth_password,String auth_security_token) {
    //Request Access_token and instance domain for work 
    def http = new HTTPBuilder(sf_login_domain)
    def postBody = [
      grant_type: 'password',
      client_id: consumer_key,
      client_secret: consumer_secret,
      username: auth_username,
      password: auth_password+auth_security_token
      ]
    def jsonResult ;
    try{ 

    http.post( path : 'services/oauth2/token',
              body : postBody,
              requestContentType: URLENC) { resp, json ->
            Utils.printlnLog (resp);
            Utils.printlnLog (json)
            jsonResult = json ;
            //access_token = json.access_token
            //instance_domain = json.instance_url +"/"
          }

    }catch(HttpResponseException e){
      Utils.printlnLog "Error code: ${e.statusCode}"
      Utils.printlnLog "Post form: $postBody \n"
      Utils.printlnLog e.getMessage();
    }

    Utils.printlnLog "Access Token : "+jsonResult.access_token
    Utils.printlnLog "Instance domain : "+jsonResult.instance_url
    return jsonResult ;
  }

}

class UtilsSFDC {

  static getPackageIdFromUrl(String url) {
    def http = new HTTPBuilder(url)
    def html = http.get(path: '').toString()
    def packageId = html.substring(html.indexOf("apexp?p0=")+9)
    packageId = packageId.substring(0,packageId.indexOf("')"))
    Utils.printlnLog ('PackageId found from '+url+': '+packageId)
    return packageId
  }

	static def waitCommunityActive(String url, int maxWaitInSeconds) {    
		def status = null ;
		long start = System.currentTimeMillis();
		while (status != 200 && ((System.currentTimeMillis() - start) /1000F) < maxWaitInSeconds) {
			def http = new HTTPBuilder(url)
      try{ 
          http.get( path : '/') { resp, reader ->
            println "response status: ${resp.statusLine}"
            status = resp.status
            println 'Headers: -----------'
            resp.headers.each { h ->
              println " ${h.name} : ${h.value}"
            }
            println 'Response data: -----'
            System.out << reader
            println '\n--------------------'
          } 
      } 
      catch(HttpResponseException e){
            Utils.printlnLog "Error code: ${e.status} for ${url}"
            Utils.printlnLog e.getMessage();
            Utils.printlnLog("Elapsed: "+(System.currentTimeMillis() - start) /1000F)+' secs'
            Thread.sleep(5000); // wait until next attempt

      }
		}

		println 'URL check time: '+((System.currentTimeMillis() - start) /1000F)
		return status == 200 ;
	}

}
